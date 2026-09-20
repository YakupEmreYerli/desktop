/**
 * Chromium's GPU rasteriser on some Linux setups writes its output with a
 * plain 2.2 gamma curve while the compositor draws its own window decorations
 * with the sRGB curve. A colour handed to CSS therefore lands on screen a
 * shade lighter than the same colour painted by the desktop next to it, which
 * is visible where the two meet: at the app's menu bar, right under the
 * window's titlebar.
 *
 * `compensateForDisplayGamma` undoes that: it returns the colour to give CSS
 * so that what lands on screen is the colour that was asked for. Measured on
 * KDE Plasma 6 on Wayland, where #05182f came out as #0d1e33 and the numbers
 * below reproduce that exactly.
 *
 * If a later Chromium stops doing this the compensation has to go with it,
 * which is why it lives on its own and is only used for the colours we take
 * from the desktop and have to match pixel for pixel.
 */

const srgbToLinear = (value: number) =>
  value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4)

const linearToSrgb = (value: number) =>
  value <= 0.0031308 ? value * 12.92 : 1.055 * Math.pow(value, 1 / 2.4) - 0.055

/** How Chromium encodes what it draws on the affected setups */
const DisplayGamma = 2.2

/**
 * The value to paint so that `channel` (0-255, sRGB) is what ends up on
 * screen.
 */
export function compensateChannelForDisplayGamma(channel: number) {
  const clamped = Math.min(Math.max(channel, 0), 255) / 255
  const linear = Math.pow(clamped, DisplayGamma)

  return Math.round(linearToSrgb(linear) * 255)
}

/** The inverse, i.e. what a painted `channel` looks like on screen */
export function displayGammaOfChannel(channel: number) {
  const clamped = Math.min(Math.max(channel, 0), 255) / 255

  return Math.round(Math.pow(srgbToLinear(clamped), 1 / DisplayGamma) * 255)
}
