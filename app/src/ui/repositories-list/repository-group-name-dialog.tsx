import * as React from 'react'
import { Dialog, DialogContent, DialogError, DialogFooter } from '../dialog'
import { OkCancelButtonGroup } from '../dialog/ok-cancel-button-group'
import { TextBox } from '../lib/text-box'
import { repositoryGroupsStore } from '../lib/repository-groups-store'
import {
  assignRepository,
  createGroup,
  findGroup,
  renameGroup,
} from '../../lib/repository-groups'

interface IRepositoryGroupNameDialogProps {
  /** The group to rename, or null to create one. */
  readonly groupName: string | null
  /** A repository to put in the new group. */
  readonly repositoryPath: string | null
  readonly onDismissed: () => void
}

interface IRepositoryGroupNameDialogState {
  readonly name: string
}

/** Names a new repository group or renames one. */
export class RepositoryGroupNameDialog extends React.Component<
  IRepositoryGroupNameDialogProps,
  IRepositoryGroupNameDialogState
> {
  public constructor(props: IRepositoryGroupNameDialogProps) {
    super(props)
    this.state = { name: props.groupName ?? '' }
  }

  private getError() {
    const name = this.state.name.trim()
    const existing = findGroup(repositoryGroupsStore.getLayout(), name)
    return existing !== undefined && existing.name !== this.props.groupName
      ? `A group named "${existing.name}" already exists.`
      : null
  }

  public render() {
    const renaming = this.props.groupName !== null
    const title = renaming
      ? __DARWIN__
        ? 'Rename Group'
        : 'Rename group'
      : __DARWIN__
      ? 'New Group'
      : 'New group'
    const error = this.getError()

    return (
      <Dialog
        id="repository-group-name"
        title={title}
        onDismissed={this.props.onDismissed}
        onSubmit={this.onSubmit}
      >
        {error !== null && <DialogError>{error}</DialogError>}
        <DialogContent>
          <TextBox
            label="Name"
            value={this.state.name}
            onValueChanged={this.onNameChanged}
            autoFocus={true}
          />
        </DialogContent>
        <DialogFooter>
          <OkCancelButtonGroup
            okButtonText={renaming ? 'Rename' : 'Create'}
            okButtonDisabled={
              this.state.name.trim().length === 0 || error !== null
            }
          />
        </DialogFooter>
      </Dialog>
    )
  }

  private onNameChanged = (name: string) => {
    this.setState({ name })
  }

  private onSubmit = () => {
    const { groupName, repositoryPath } = this.props
    const name = this.state.name.trim()
    repositoryGroupsStore.update(layout =>
      groupName !== null
        ? renameGroup(layout, groupName, name)
        : repositoryPath !== null
        ? assignRepository(layout, repositoryPath, name)
        : createGroup(layout, name)
    )
    this.props.onDismissed()
  }
}
