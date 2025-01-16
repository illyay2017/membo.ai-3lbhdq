import * as React from 'react';
import { debounce } from 'lodash';
import { Select } from '../ui/select';
import { ContentStatus, ContentSource } from '../../types/content';
import { useContentStore } from '../../store/contentStore';
import { colors } from '../../constants/theme';

// Constants for filter options
const STATUS_OPTIONS = [
  { label: 'All', value: '' },
  { label: 'New', value: ContentStatus.NEW },
  { label: 'Processing', value: ContentStatus.PROCESSING },
  { label: 'Processed', value: ContentStatus.PROCESSED },
  { label: 'Archived', value: ContentStatus.ARCHIVED }
];

const SOURCE_OPTIONS = [
  { label: 'All', value: '' },
  { label: 'Web', value: ContentSource.WEB },
  { label: 'PDF', value: ContentSource.PDF },
  { label: 'Kindle', value: ContentSource.KINDLE },
  { label: 'Manual', value: ContentSource.MANUAL }
];

interface ContentFiltersProps {
  className?: string;
}

/**
 * ContentFilters component provides accessible filtering controls for content items
 * Implements debounced search, keyboard navigation, and screen reader support
 */
const ContentFilters: React.FC<ContentFiltersProps> = ({ className }) => {
  const { filters, setFilters } = useContentStore();

  // Handle status filter changes with type safety
  const handleStatusChange = React.useCallback((status: ContentStatus | '') => {
    try {
      setFilters({
        ...filters,
        status: status ? [status] : undefined,
        page: 1 // Reset pagination when filter changes
      });
    } catch (error) {
      console.error('Failed to update status filter:', error);
    }
  }, [filters, setFilters]);

  // Handle source filter changes with type safety
  const handleSourceChange = React.useCallback((source: ContentSource | '') => {
    try {
      setFilters({
        ...filters,
        source: source ? [source] : undefined,
        page: 1 // Reset pagination when filter changes
      });
    } catch (error) {
      console.error('Failed to update source filter:', error);
    }
  }, [filters, setFilters]);

  // Handle search text changes with debouncing
  const handleSearchChange = React.useCallback(
    debounce((event: React.ChangeEvent<HTMLInputElement>) => {
      try {
        const searchText = event.target.value.trim();
        setFilters({
          ...filters,
          searchText: searchText || undefined,
          page: 1 // Reset pagination when search changes
        });
      } catch (error) {
        console.error('Failed to update search filter:', error);
      }
    }, 300),
    [filters, setFilters]
  );

  return (
    <div 
      className={`flex flex-col gap-4 md:flex-row md:items-center ${className}`}
      role="search"
      aria-label="Content filters"
    >
      {/* Status filter */}
      <Select
        options={STATUS_OPTIONS}
        value={filters.status?.[0] || ''}
        onChange={handleStatusChange}
        placeholder="Filter by status"
        aria-label="Filter by status"
        className="min-w-[160px]"
        size="md"
        variant="outline"
      />

      {/* Source filter */}
      <Select
        options={SOURCE_OPTIONS}
        value={filters.source?.[0] || ''}
        onChange={handleSourceChange}
        placeholder="Filter by source"
        aria-label="Filter by source"
        className="min-w-[160px]"
        size="md"
        variant="outline"
      />

      {/* Search input */}
      <div className="relative flex-1">
        <input
          type="search"
          placeholder="Search content..."
          defaultValue={filters.searchText || ''}
          onChange={handleSearchChange}
          className={`
            w-full rounded-md border-2 border-[${colors.primary}] 
            px-4 py-2 outline-none transition-colors
            focus:ring-2 focus:ring-primary-light
            dark:bg-gray-800 dark:text-white
          `}
          aria-label="Search content"
        />
      </div>
    </div>
  );
};

export default ContentFilters;