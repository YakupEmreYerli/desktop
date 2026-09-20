/**
 * The colours the desktop environment paints an application's header with.
 *
 * On KDE these come from the current colour scheme's `Header` group, the same
 * place Konsole and the other KDE applications read their titlebar colours
 * from, so that the app's toolbar matches the rest of the desktop.
 */
export interface ISystemHeaderColors {
  /** The header background, as a CSS colour */
  readonly background: string

  /** The text on the header, as a CSS colour */
  readonly foreground: string
}
