export type CLIAction =
  | {
      readonly kind: 'open-repository'
      readonly path: string
    }
  | {
      readonly kind: 'clone-url'
      readonly url: string
      readonly branch?: string
    }
  | {
      readonly kind: 'add-repository' | 'remove-repository'
      readonly path: string
    }
