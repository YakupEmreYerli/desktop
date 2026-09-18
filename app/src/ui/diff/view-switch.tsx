import * as React from 'react'
import classNames from 'classnames'
import { Octicon } from '../octicons'
import type { OcticonSymbolVariants } from '../octicons/octicons.generated'

export interface IViewSwitchOption<T extends string> {
  readonly value: T
  readonly label: string
  readonly icon: OcticonSymbolVariants
}

interface IViewSwitchProps<T extends string> {
  readonly options: ReadonlyArray<IViewSwitchOption<T>>
  readonly selected: T
  readonly ariaLabel: string
  readonly onSelect: (value: T) => void
}

interface IViewSwitchButtonProps<T extends string> {
  readonly option: IViewSwitchOption<T>
  readonly selected: boolean
  readonly onSelect: (value: T) => void
}

class ViewSwitchButton<T extends string> extends React.Component<
  IViewSwitchButtonProps<T>
> {
  private onClick = () => this.props.onSelect(this.props.option.value)

  public render() {
    const { option, selected } = this.props
    return (
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        className={classNames('view-switch-option', { selected })}
        onClick={this.onClick}
      >
        <Octicon symbol={option.icon} />
        {option.label}
      </button>
    )
  }
}

/**
 * A small segmented control that switches how a file is shown (code,
 * preview, translation). Styles in _view-switch.scss.
 */
export class ViewSwitch<T extends string> extends React.Component<
  IViewSwitchProps<T>
> {
  public render() {
    return (
      <div
        className="view-switch"
        role="radiogroup"
        aria-label={this.props.ariaLabel}
      >
        {this.props.options.map(option => (
          <ViewSwitchButton
            key={option.value}
            option={option}
            selected={option.value === this.props.selected}
            onSelect={this.props.onSelect}
          />
        ))}
      </div>
    )
  }
}
