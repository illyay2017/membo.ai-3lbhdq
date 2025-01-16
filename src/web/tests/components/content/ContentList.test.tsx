import * as React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import ContentList from '../../../src/components/content/ContentList';
import { generateMockContent } from '../../utils/testHelpers';
import { useContentStore } from '../../../src/store/contentStore';
import { useWebSocket } from '../../../src/hooks/useWebSocket';
import { ContentStatus, ContentSource } from '../../../src/types/content';

// Mock dependencies
vi.mock('../../../src/store/contentStore');
vi.mock('../../../src/hooks/useWebSocket');
vi.mock('react-intersection-observer', () => ({
  useInView: () => ({ ref: vi.fn(), inView: false })
}));

// Add jest-axe matchers
expect.extend(toHaveNoViolations);

// Enhanced test setup function
const setup = (
  customProps = {},
  mockStoreData = {
    contents: [],
    isLoading: false,
    totalCount: 0,
    filters: {},
    setFilters: vi.fn()
  }
) => {
  // Mock store implementation
  const mockStore = {
    ...mockStoreData,
    fetchContents: vi.fn(),
    updateContent: vi.fn(),
    clearError: vi.fn()
  };
  (useContentStore as any).mockReturnValue(mockStore);

  // Mock WebSocket implementation
  const mockWebSocket = {
    connect: vi.fn(),
    disconnect: vi.fn(),
    subscribe: vi.fn(),
    isConnected: true,
    connectionQuality: 'excellent'
  };
  (useWebSocket as any).mockReturnValue(mockWebSocket);

  // Setup performance measurement
  const performanceMark = vi.spyOn(performance, 'mark');
  const performanceMeasure = vi.spyOn(performance, 'measure');

  // Render component with props
  const result = render(
    <ContentList 
      {...customProps}
      aria-label="Content list"
      role="feed"
    />
  );

  return {
    ...result,
    mockStore,
    mockWebSocket,
    performanceMark,
    performanceMeasure
  };
};

describe('ContentList Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders empty state correctly', () => {
      setup();
      expect(screen.getByText(/No content found/i)).toBeInTheDocument();
      expect(screen.getByRole('feed')).toHaveAttribute('aria-busy', 'false');
    });

    it('renders loading state correctly', () => {
      setup({}, { isLoading: true });
      expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Loading more content');
      expect(screen.getByRole('feed')).toHaveAttribute('aria-busy', 'true');
    });

    it('renders content items correctly', () => {
      const mockContents = [
        generateMockContent(),
        generateMockContent()
      ];
      setup({}, { contents: mockContents });

      mockContents.forEach(content => {
        expect(screen.getByText(content.metadata.title)).toBeInTheDocument();
      });
    });

    it('applies correct styling and layout', () => {
      const { container } = setup();
      expect(container.querySelector('.space-y-4')).toBeInTheDocument();
      expect(container.querySelector('.relative.h-[800px].overflow-auto')).toBeInTheDocument();
    });
  });

  describe('Content Interaction', () => {
    it('handles infinite scroll loading', async () => {
      const mockStore = {
        contents: [generateMockContent()],
        isLoading: false,
        totalCount: 2,
        filters: {}
      };
      const { mockWebSocket } = setup({}, mockStore);

      // Trigger scroll event
      fireEvent.scroll(screen.getByRole('feed'), {
        target: { scrollTop: 1000 }
      });

      await waitFor(() => {
        expect(mockStore.fetchContents).toHaveBeenCalledWith(
          expect.objectContaining({ page: 2 })
        );
      });
    });

    it('filters content correctly', async () => {
      const { mockStore } = setup();
      const filterSelect = screen.getByLabelText(/Filter by status/i);

      await userEvent.selectOptions(filterSelect, ContentStatus.PROCESSED);

      expect(mockStore.setFilters).toHaveBeenCalledWith(
        expect.objectContaining({
          status: [ContentStatus.PROCESSED]
        })
      );
    });

    it('updates content in real-time', async () => {
      const mockContent = generateMockContent();
      const { mockWebSocket } = setup({}, { contents: [mockContent] });

      // Simulate WebSocket update
      const updateCallback = mockWebSocket.subscribe.mock.calls[0][1];
      const updatedContent = { ...mockContent, status: ContentStatus.PROCESSED };
      updateCallback(updatedContent);

      await waitFor(() => {
        expect(screen.getByText(/Processed/i)).toBeInTheDocument();
      });
    });
  });

  describe('Performance', () => {
    it('renders initial content within 200ms', async () => {
      const { performanceMeasure } = setup();
      
      await waitFor(() => {
        const measure = performanceMeasure.mock.calls[0][1];
        expect(measure.duration).toBeLessThan(200);
      });
    });

    it('handles large content lists efficiently', async () => {
      const largeContentList = Array.from({ length: 100 }, () => generateMockContent());
      const { performanceMeasure } = setup({}, { contents: largeContentList });

      await waitFor(() => {
        const measure = performanceMeasure.mock.calls[0][1];
        expect(measure.duration).toBeLessThan(500);
      });
    });

    it('optimizes re-renders', async () => {
      const { rerender, performanceMeasure } = setup();
      
      // Force re-render
      rerender(<ContentList />);

      await waitFor(() => {
        const reRenderMeasure = performanceMeasure.mock.calls[1][1];
        expect(reRenderMeasure.duration).toBeLessThan(100);
      });
    });
  });

  describe('Accessibility', () => {
    it('meets WCAG 2.1 requirements', async () => {
      const { container } = setup();
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('supports keyboard navigation', async () => {
      setup({}, { contents: [generateMockContent()] });
      
      const list = screen.getByRole('feed');
      await userEvent.tab();
      
      expect(list).toHaveFocus();
      expect(list).toHaveAttribute('tabIndex', '0');
    });

    it('provides correct ARIA attributes', () => {
      const { container } = setup();
      
      expect(screen.getByRole('feed')).toHaveAttribute('aria-label', 'Content list');
      expect(container.querySelector('[aria-controls="content-list"]')).toBeInTheDocument();
    });
  });

  describe('Real-time Updates', () => {
    it('connects to WebSocket correctly', () => {
      const { mockWebSocket } = setup();
      expect(mockWebSocket.connect).toHaveBeenCalled();
    });

    it('handles connection errors gracefully', async () => {
      const { mockWebSocket } = setup();
      
      // Simulate connection error
      mockWebSocket.isConnected = false;
      const errorCallback = mockWebSocket.subscribe.mock.calls[0][1];
      errorCallback(new Error('Connection failed'));

      await waitFor(() => {
        expect(mockWebSocket.connect).toHaveBeenCalledTimes(2);
      });
    });

    it('reconnects automatically', async () => {
      const { mockWebSocket } = setup();
      
      // Simulate disconnect
      mockWebSocket.isConnected = false;
      const disconnectCallback = mockWebSocket.subscribe.mock.calls[1][1];
      disconnectCallback();

      await waitFor(() => {
        expect(mockWebSocket.connect).toHaveBeenCalledTimes(2);
      });
    });
  });
});