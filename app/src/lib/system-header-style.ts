/**
 * How the desktop environment paints an application's header, so that the
 * app's menu bar can sit under the window's titlebar as one strip.
 *
 * On KDE this is the current colour scheme's `Header` group and the menu font
 * from `kdeglobals`, the same places Konsole and the other KDE applications
 * read theirs from.
 */
export interface ISystemHeaderStyle {
  /** The header background, as a CSS colour */
  readonly background: string

  /** The text on the header, as a CSS colour */
  readonly foreground: string

  /** The background of the desktop's menus, as a CSS colour */
  readonly menuBackground: string

  /** The text in the desktop's menus, as a CSS colour */
  readonly menuForeground: string

  /** The font family of the desktop's menus, if it says */
  readonly fontFamily: string | null

  /** The font size of the desktop's menus, as a CSS length, if it says */
  readonly fontSize: string | null
}
