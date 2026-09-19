import * as React from 'react'
import { IMenuItem, showContextualMenu } from '../../lib/menu-item'
import { PopupType } from '../../models/popup'
import { Repository } from '../../models/repository'
import { Dispatcher } from '../dispatcher'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'
import { TooltippedContent } from '../lib/tooltipped-content'
import { repositoryGroupsStore } from '../lib/repository-groups-store'
import {
  IRepositoryGroupsLayout,
  assignRepository,
  deleteGroup,
  findGroupOf,
  getSectionKey,
  isHidden,
  moveGroup,
  setCollapsed,
  setHidden,
  setShowRecent,
} from '../../lib/repository-groups'
import { IRepositorySectionHeader } from './arrange-repositories'
import { Repositoryish } from './group-repositories'

const label = (darwin: string, other: string) => (__DARWIN__ ? darwin : other)

const toggleCollapsed = (header: IRepositorySectionHeader) =>
  repositoryGroupsStore.update(l =>
    setCollapsed(l, header.section, !header.collapsed)
  )

function showRecentItem(layout: IRepositoryGroupsLayout): IMenuItem {
  return {
    label: label('Show Recent Group', 'Show recent group'),
    type: 'checkbox',
    checked: layout.showRecent,
    action: () =>
      repositoryGroupsStore.update(l => setShowRecent(l, !l.showRecent)),
  }
}

/** "Move to group" and "Hide" for a repository's context menu. */
export function buildRepositoryGroupMenuItems(
  repository: Repositoryish,
  dispatcher: Dispatcher
): ReadonlyArray<IMenuItem> {
  if (!(repository instanceof Repository)) {
    return []
  }
  const layout = repositoryGroupsStore.getLayout()
  const path = repository.path
  const current = findGroupOf(layout, path)
  const hidden = isHidden(layout, path)

  const groups: ReadonlyArray<IMenuItem> = layout.groups.map(g => ({
    label: g.name,
    type: 'checkbox',
    checked: g === current,
    action: () =>
      repositoryGroupsStore.update(l => assignRepository(l, path, g.name)),
  }))

  const submenu: Array<IMenuItem> = [
    ...groups,
    ...(groups.length > 0 ? [{ type: 'separator' } as const] : []),
    {
      label: label('New Group…', 'New group…'),
      action: () =>
        dispatcher.showPopup({
          type: PopupType.RepositoryGroupName,
          groupName: null,
          repositoryPath: path,
        }),
    },
  ]
  if (current !== undefined) {
    submenu.push({
      label: label('Remove from Group', 'Remove from group'),
      action: () =>
        repositoryGroupsStore.update(l => assignRepository(l, path, null)),
    })
  }

  return [
    { label: label('Move to Group', 'Move to group'), submenu },
    {
      label: hidden ? 'Unhide' : 'Hide',
      action: () =>
        repositoryGroupsStore.update(l => setHidden(l, path, !hidden)),
    },
    { type: 'separator' },
  ]
}

function showSectionContextMenu(
  header: IRepositorySectionHeader,
  dispatcher: Dispatcher
) {
  const layout = repositoryGroupsStore.getLayout()
  const { section } = header
  const items = new Array<IMenuItem>({
    label: header.collapsed ? 'Expand' : 'Collapse',
    action: () => toggleCollapsed(header),
  })

  if (section.kind === 'custom') {
    const index = layout.groups.findIndex(g => g.name === section.name)
    const name = section.name
    items.push(
      { type: 'separator' },
      {
        label: label('Rename…', 'Rename…'),
        action: () =>
          dispatcher.showPopup({
            type: PopupType.RepositoryGroupName,
            groupName: name,
            repositoryPath: null,
          }),
      },
      {
        label: label('Move Up', 'Move up'),
        enabled: index > 0,
        action: () =>
          repositoryGroupsStore.update(l => moveGroup(l, name, index - 1)),
      },
      {
        label: label('Move Down', 'Move down'),
        enabled: index < layout.groups.length - 1,
        action: () =>
          repositoryGroupsStore.update(l => moveGroup(l, name, index + 1)),
      },
      {
        label: label('Delete Group', 'Delete group'),
        action: () => repositoryGroupsStore.update(l => deleteGroup(l, name)),
      }
    )
  }

  items.push(
    { type: 'separator' },
    {
      label: label('New Group…', 'New group…'),
      action: () =>
        dispatcher.showPopup({
          type: PopupType.RepositoryGroupName,
          groupName: null,
          repositoryPath: null,
        }),
    },
    showRecentItem(layout)
  )

  showContextualMenu(items)
}

interface IRepositorySectionHeaderProps {
  readonly header: IRepositorySectionHeader
  readonly dispatcher: Dispatcher
}

/**
 * A section header that collapses on click and has the group actions on
 * right click.
 */
class RepositorySectionHeader extends React.Component<IRepositorySectionHeaderProps> {
  public render() {
    const { header } = this.props
    return (
      <button
        type="button"
        className="filter-list-group-header repository-section-header"
        aria-expanded={!header.collapsed}
        onClick={this.onClick}
        onContextMenu={this.onContextMenu}
      >
        <Octicon
          className="repository-section-chevron"
          symbol={
            header.collapsed ? octicons.chevronRight : octicons.chevronDown
          }
        />
        <TooltippedContent
          className="repository-section-label"
          tooltip={header.label}
          onlyWhenOverflowed={true}
        >
          {header.label}
        </TooltippedContent>
        {header.collapsed && (
          <span className="repository-section-count">{header.count}</span>
        )}
      </button>
    )
  }

  private onClick = () => toggleCollapsed(this.props.header)

  private onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    showSectionContextMenu(this.props.header, this.props.dispatcher)
  }
}

export function renderRepositorySectionHeader(
  header: IRepositorySectionHeader,
  dispatcher: Dispatcher
) {
  return (
    <RepositorySectionHeader
      key={getSectionKey(header.section)}
      header={header}
      dispatcher={dispatcher}
    />
  )
}
