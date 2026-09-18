import * as React from 'react'
import {
  Popover,
  PopoverAnchorPosition,
  PopoverDecoration,
} from '../lib/popover'
import {
  countActiveFilterOptions,
  hasActiveFilters,
} from './filter-changes-logic'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'
import { IFileListFilterState } from '../../lib/app-state'
import { Checkbox, CheckboxValue } from '../lib/checkbox'
import memoizeOne from 'memoize-one'
import { Button } from '../lib/button'
import classNames from 'classnames'
import { IChangesListItem } from './filter-changes-list'
import { WorkingDirectoryStatus } from '../../models/status'

interface IChangesListFilterOptionsProps {
  readonly fileListFilter: IFileListFilterState
  readonly filteredItems: Map<string, IChangesListItem>
  readonly workingDirectory: WorkingDirectoryStatus
  readonly onFilterToIncludedInCommit: () => void
  readonly onFilterExcludedFiles: () => void
  readonly onFilterDeletedFiles: () => void
  readonly onFilterModifiedFiles: () => void
  readonly onFilterNewFiles: () => void
  readonly onClearAllFilters: () => void
}

interface IChangesListFilterOptionsState {
  readonly isFilterOptionsOpen: boolean
}

/**
 * Component to render filter options for the changes list.
 *
 * Allows users to filter files based on their status (new, modified, deleted, etc.)
 * and includes a button to clear all filters.
 */
export class ChangesListFilterOptions extends React.Component<
  IChangesListFilterOptionsProps,
  IChangesListFilterOptionsState
> {
  private getFilterCounts = memoizeOne(
    (
      wd: WorkingDirectoryStatus,
      filteredItems: Map<string, IChangesListItem>
    ) => {
      const counts = {
        newFilesCount: 0,
        modifiedFilesCount: 0,
        deletedFilesCount: 0,
        includedFilesCount: 0,
        excludedFilesCount: 0,
      }

      Array.from(filteredItems.values()).forEach(v => {
        const file = wd.findFileWithID(v.id)
        if (file) {
          if (file.isNew() || file.isUntracked()) {
            counts.newFilesCount++
          }
          if (file.isModified()) {
            counts.modifiedFilesCount++
          }
          if (file.isDeleted()) {
            counts.deletedFilesCount++
          }
          if (file.isIncludedInCommit()) {
            counts.includedFilesCount++
          }
          if (file.isExcludedFromCommit()) {
            counts.excludedFilesCount++
          }
        }
      })

      return counts
    }
  )

  private filterOptionsButtonRef: HTMLButtonElement | null = null

  public constructor(props: IChangesListFilterOptionsProps) {
    super(props)

    this.state = {
      isFilterOptionsOpen: false,
    }
  }

  private closeFilterOptions = () => {
    this.setState({ isFilterOptionsOpen: false })
  }

  private onClearAllFilters = () => {
    this.props.onClearAllFilters()
    this.closeFilterOptions()
  }

  // Opens the filter options popover, or closes it if it's already open.
  private toggleFilterOptionsOpen = () => {
    this.setState(prevState => ({
      isFilterOptionsOpen: !prevState.isFilterOptionsOpen,
    }))
  }

  private renderFilterOptions() {
    // Check if any filters are active
    const filtersActive = hasActiveFilters(this.props.fileListFilter)

    const {
      newFilesCount,
      modifiedFilesCount,
      deletedFilesCount,
      excludedFilesCount,
      includedFilesCount,
    } = this.getFilterCounts(
      this.props.workingDirectory,
      this.props.filteredItems
    )

    return (
      <Popover
        className="filter-popover"
        ariaLabelledby="filter-options-header"
        anchor={this.filterOptionsButtonRef}
        anchorPosition={PopoverAnchorPosition.BottomRight}
        decoration={PopoverDecoration.Balloon}
        onMousedownOutside={this.closeFilterOptions}
        onClickOutside={this.closeFilterOptions}
      >
        <div className="filter-popover-header">
          <h3 id="filter-options-header">Filter Options</h3>
          <button
            className="close"
            onClick={this.closeFilterOptions}
            aria-label="Close"
          >
            <Octicon symbol={octicons.x} />
          </button>
        </div>
        <div className="filter-options">
          {this.renderOption(
            'Included in commit',
            includedFilesCount,
            this.props.fileListFilter.isIncludedInCommit,
            this.props.onFilterToIncludedInCommit
          )}
          {this.renderOption(
            'Excluded from commit',
            excludedFilesCount,
            this.props.fileListFilter.isExcludedFromCommit,
            this.props.onFilterExcludedFiles
          )}
          <div className="filter-options-separator" role="separator" />
          {this.renderOption(
            'New files',
            newFilesCount,
            this.props.fileListFilter.isNewFile,
            this.props.onFilterNewFiles
          )}
          {this.renderOption(
            'Modified files',
            modifiedFilesCount,
            this.props.fileListFilter.isModifiedFile,
            this.props.onFilterModifiedFiles
          )}
          {this.renderOption(
            'Deleted files',
            deletedFilesCount,
            this.props.fileListFilter.isDeletedFile,
            this.props.onFilterDeletedFiles
          )}
        </div>
        {filtersActive && (
          <div className="filter-options-footer">
            <Button onClick={this.onClearAllFilters}>Clear filters</Button>
          </div>
        )}
      </Popover>
    )
  }

  private renderOption(
    label: string,
    count: number,
    checked: boolean,
    onChange: () => void
  ) {
    return (
      <Checkbox
        className={classNames('filter-option', { empty: count === 0 })}
        value={checked ? CheckboxValue.On : CheckboxValue.Off}
        onChange={onChange}
        label={
          <>
            <span className="filter-option-label">{label}</span>
            <span className="filter-option-count">{count}</span>
          </>
        }
      />
    )
  }

  private onFilterOptionsButtonRef = (buttonRef: HTMLButtonElement | null) => {
    this.filterOptionsButtonRef = buttonRef
  }

  public render() {
    const activeFiltersCount = countActiveFilterOptions(
      this.props.fileListFilter
    )
    const hasActiveFilters = activeFiltersCount > 0
    const buttonTextLabel = `Filter Options ${
      hasActiveFilters ? `(${activeFiltersCount} applied)` : ''
    }`

    return (
      <>
        <Button
          className={classNames('filter-button', {
            active: hasActiveFilters,
          })}
          onClick={this.toggleFilterOptionsOpen}
          ariaExpanded={this.state.isFilterOptionsOpen}
          onButtonRef={this.onFilterOptionsButtonRef}
          tooltip={buttonTextLabel}
          ariaLabel={buttonTextLabel}
        >
          <span>
            <Octicon symbol={octicons.filter} />
          </span>
          {hasActiveFilters ? (
            <span className="active-badge">
              <div className="badge-bg">
                <div className="badge"></div>
              </div>
            </span>
          ) : null}
          <Octicon symbol={octicons.triangleDown} />
        </Button>
        {this.state.isFilterOptionsOpen && this.renderFilterOptions()}
      </>
    )
  }
}
