import * as React from "react"
import { cn } from "@/lib/utils"
import Select from "../ui/select"
import { STUDY_MODES } from "../../constants/study"
import type { Card } from "../../types/card"

// User authorization tiers
export enum UserTier {
  FREE = "free",
  PRO = "pro",
  POWER = "power"
}

// Study mode access configuration by user tier
const TIER_MODE_ACCESS: Record<UserTier, STUDY_MODES[]> = {
  [UserTier.FREE]: [STUDY_MODES.STANDARD],
  [UserTier.PRO]: [STUDY_MODES.STANDARD, STUDY_MODES.VOICE],
  [UserTier.POWER]: [STUDY_MODES.STANDARD, STUDY_MODES.VOICE, STUDY_MODES.QUIZ]
} as const;

// Sort options with labels and values
const SORT_OPTIONS = [
  { value: "next-review", label: "Next Review" },
  { value: "created-desc", label: "Newest First" },
  { value: "created-asc", label: "Oldest First" },
  { value: "difficulty-desc", label: "Most Difficult" },
  { value: "difficulty-asc", label: "Least Difficult" },
  { value: "success-rate-desc", label: "Highest Success Rate" },
  { value: "success-rate-asc", label: "Lowest Success Rate" }
]

// Props interface for the CardFilters component
interface CardFiltersProps {
  selectedMode: STUDY_MODES | null
  selectedTags: string[]
  selectedSort: string
  onModeChange: (mode: STUDY_MODES | null) => void
  onTagsChange: (tags: string[]) => void
  onSortChange: (sort: string) => void
  availableTags?: string[]
  userTier?: UserTier
  cardCount?: number
}

export const CardFilters: React.FC<CardFiltersProps> = ({
  selectedMode,
  selectedTags = [],
  selectedSort,
  onModeChange,
  onTagsChange,
  onSortChange,
  availableTags = [],
  userTier = UserTier.FREE,
  cardCount = 0
}) => {
  // Convert study modes to select options based on user tier access
  const studyModeOptions = React.useMemo(() => {
    const allowedModes = TIER_MODE_ACCESS[userTier] || [STUDY_MODES.STANDARD]; // Fallback to standard mode
    return [
      { value: "", label: "All Modes" },
      ...Object.values(STUDY_MODES).map(mode => ({
        value: mode,
        label: mode.charAt(0).toUpperCase() + mode.slice(1),
        disabled: !allowedModes.includes(mode)
      }))
    ]
  }, [userTier])

  // Convert available tags to select options - with null check
  const tagOptions = React.useMemo(() => {
    if (!availableTags?.length) return []
    return availableTags.map(tag => ({
      value: tag,
      label: tag
    }))
  }, [availableTags])

  // Handle study mode changes with tier validation
  const handleModeChange = React.useCallback((mode: string) => {
    if (!mode) {
      onModeChange(null)
      return
    }

    const selectedMode = mode as STUDY_MODES
    const allowedModes = TIER_MODE_ACCESS[userTier] || [STUDY_MODES.STANDARD]

    if (allowedModes.includes(selectedMode)) {
      onModeChange(selectedMode)
    }
  }, [userTier, onModeChange])

  // Handle tag selection changes with optimization
  const handleTagsChange = React.useCallback((tags: string[]) => {
    const validTags = tags.filter(tag => availableTags.includes(tag))
    const uniqueTags = Array.from(new Set(validTags)).sort()
    onTagsChange(uniqueTags)
  }, [availableTags, onTagsChange])

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Study Mode Filter */}
        <Select
          value={selectedMode || ""}
          options={studyModeOptions}
          onChange={handleModeChange}
          placeholder="Select Study Mode"
          className="w-full sm:w-48"
        />

        {/* Tag Filter - only show if we have tags */}
        {tagOptions.length > 0 && (
          <Select
            multiple
            value={selectedTags}
            onChange={handleTagsChange}
            options={tagOptions}
            placeholder="Filter by Tags"
            className="w-full sm:w-64"
          />
        )}

        {/* Sort Options */}
        <Select
          value={selectedSort}
          options={SORT_OPTIONS}
          onChange={value => onSortChange(value)}
          placeholder="Sort Cards"
          className="w-full sm:w-48"
        />
      </div>

      {/* Filter Summary */}
      <div className="text-sm text-secondary">
        {cardCount} card{cardCount !== 1 ? 's' : ''} found
        {selectedMode && ` • ${selectedMode} mode`}
        {selectedTags.length > 0 && ` • ${selectedTags.length} tag${selectedTags.length !== 1 ? 's' : ''}`}
      </div>

      {/* Pro Feature Notice */}
      {userTier === UserTier.FREE && (
        <div className="text-sm text-secondary bg-secondary/10 rounded-md p-2">
          Upgrade to Pro for access to Voice mode and advanced filtering options
        </div>
      )}
    </div>
  )
}

export default CardFilters
