import * as React from 'react'

import { AppFileStatusKind } from '../../../models/status'
import { ImageDiffType } from '../../../models/diff'
import { getBoolean, setBoolean } from '../../../lib/local-storage'
import { svgImageFromLines } from '../../../lib/svg'
import * as OcticonSymbol from '../../octicons/octicons.generated'
import { IViewSwitchOption, ViewSwitch } from '../view-switch'
import { IFileContents } from '../syntax-highlighting'
import {
  DeletedImageDiff,
  ModifiedImageDiff,
  NewImageDiff,
} from '../image-diffs'

/** Remembers whether SVG files open in the code view instead of the preview */
const ShowCodeKey = 'svg-diff-show-code'

type SvgView = 'preview' | 'code'

const ViewOptions: ReadonlyArray<IViewSwitchOption<SvgView>> = [
  { value: 'preview', label: 'Preview', icon: OcticonSymbol.image },
  { value: 'code', label: 'Code', icon: OcticonSymbol.code },
]

interface ISvgDiffProps {
  /** The old and new source of the file */
  readonly fileContents: IFileContents

  /** The regular text diff, shown in the code view */
  readonly code: JSX.Element

  /** The image diff mode (2-up, swipe, onion skin, difference) */
  readonly imageDiffType: ImageDiffType
  readonly onChangeImageDiffType: (type: ImageDiffType) => void
}

interface ISvgDiffState {
  readonly showCode: boolean
}

/**
 * Shows an SVG file either as its text diff or as images, through the same
 * views the app uses for pictures, so a modified SVG can be compared side by
 * side, swiped, onion-skinned or differenced.
 */
export class SvgDiff extends React.Component<ISvgDiffProps, ISvgDiffState> {
  public constructor(props: ISvgDiffProps) {
    super(props)
    this.state = { showCode: getBoolean(ShowCodeKey, false) }
  }

  private onSelectView = (view: SvgView) => {
    const showCode = view === 'code'
    setBoolean(ShowCodeKey, showCode)
    this.setState({ showCode })
  }

  public render() {
    const { showCode } = this.state

    return (
      <div className="svg-diff">
        <div className="svg-diff-toolbar">
          <ViewSwitch
            options={ViewOptions}
            selected={showCode ? 'code' : 'preview'}
            ariaLabel="Show the file as"
            onSelect={this.onSelectView}
          />
        </div>
        {showCode ? this.props.code : this.renderPreview()}
      </div>
    )
  }

  private renderPreview() {
    const { fileContents } = this.props
    const status = fileContents.file.status.kind

    if (
      status === AppFileStatusKind.New ||
      status === AppFileStatusKind.Untracked
    ) {
      return (
        <NewImageDiff current={svgImageFromLines(fileContents.newContents)} />
      )
    }

    if (status === AppFileStatusKind.Deleted) {
      return (
        <DeletedImageDiff
          previous={svgImageFromLines(fileContents.oldContents)}
        />
      )
    }

    return (
      <ModifiedImageDiff
        previous={svgImageFromLines(fileContents.oldContents)}
        current={svgImageFromLines(fileContents.newContents)}
        diffType={this.props.imageDiffType}
        onChangeDiffType={this.props.onChangeImageDiffType}
      />
    )
  }
}
