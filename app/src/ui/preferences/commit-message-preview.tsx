import * as React from 'react'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'
import {
  CommitMessageLanguage,
  CommitMessageStyle,
} from '../../lib/ai/commit-message'

interface IExampleCommit {
  readonly title: string
  readonly description: string
}

type ExampleLanguage = 'turkish' | 'english'

/** The same change, written in each style, in the languages the app knows */
const Examples: Record<
  Exclude<CommitMessageStyle, 'custom' | 'repository'>,
  Record<ExampleLanguage, IExampleCommit>
> = {
  plain: {
    turkish: {
      title: 'Sepete ücretsiz kargo sınırı ekle',
      description:
        '500 TL ve üzeri siparişlerde kargo ücreti alınmıyor, altındakilere 49 TL ekleniyor.',
    },
    english: {
      title: 'Add a free shipping threshold to the cart',
      description:
        'Orders of 500 TL or more ship free; smaller ones pay a 49 TL fee.',
    },
  },
  conventional: {
    turkish: {
      title: 'feat(sepet): ücretsiz kargo sınırı ekle',
      description:
        '500 TL ve üzeri siparişlerde kargo ücreti alınmıyor, altındakilere 49 TL ekleniyor.',
    },
    english: {
      title: 'feat(cart): add a free shipping threshold',
      description:
        'Orders of 500 TL or more ship free; smaller ones pay a 49 TL fee.',
    },
  },
  gitmoji: {
    turkish: {
      title: '✨ Sepete ücretsiz kargo sınırı ekle',
      description:
        '500 TL ve üzeri siparişlerde kargo ücreti alınmıyor, altındakilere 49 TL ekleniyor.',
    },
    english: {
      title: '✨ Add a free shipping threshold to the cart',
      description:
        'Orders of 500 TL or more ship free; smaller ones pay a 49 TL fee.',
    },
  },
}

/** A repository's earlier commit and the new one written to match it */
const RepositoryExamples: Record<
  ExampleLanguage,
  { readonly earlier: string; readonly written: string }
> = {
  turkish: {
    earlier: '[SEPET] Kupon kodu desteği ekle',
    written: '[SEPET] Ücretsiz kargo sınırı ekle',
  },
  english: {
    earlier: '[CART] Support coupon codes',
    written: '[CART] Add a free shipping threshold',
  },
}

function CommitCard(props: {
  readonly title: string
  readonly description?: string
  readonly muted?: boolean
}) {
  return (
    <div className={props.muted ? 'commit-preview muted' : 'commit-preview'}>
      <Octicon symbol={octicons.gitCommit} className="commit-preview-icon" />
      <div className="commit-preview-text">
        <div className="commit-preview-title">{props.title}</div>
        {props.description && (
          <div className="commit-preview-description">{props.description}</div>
        )}
      </div>
    </div>
  )
}

interface ICommitMessagePreviewProps {
  readonly language: CommitMessageLanguage
  readonly otherLanguage: string
  readonly style: CommitMessageStyle
}

/**
 * An example commit in the picked style and language, drawn like a commit
 * so it's clear what the setting produces.
 */
export class CommitMessagePreview extends React.Component<ICommitMessagePreviewProps> {
  public render() {
    const { style, language } = this.props
    if (style === 'custom') {
      return null
    }
    const shown: ExampleLanguage =
      language === 'turkish' ? 'turkish' : 'english'
    const caption = language === 'turkish' ? 'Örnek' : 'Example'

    return (
      <figure className="commit-preview-example" aria-label={caption}>
        <figcaption>{caption}</figcaption>
        {style === 'repository'
          ? this.renderRepository(shown)
          : this.renderCommit(Examples[style][shown])}
        {this.renderOtherLanguageNote()}
      </figure>
    )
  }

  private renderCommit(example: IExampleCommit) {
    return (
      <CommitCard title={example.title} description={example.description} />
    )
  }

  private renderRepository(language: ExampleLanguage) {
    const example = RepositoryExamples[language]
    const turkish = language === 'turkish'
    return (
      <>
        <div className="commit-preview-step">
          {turkish ? 'Depodaki son commit' : 'An earlier commit'}
        </div>
        <CommitCard title={example.earlier} muted={true} />
        <div className="commit-preview-step">
          {turkish ? 'Yazılan commit' : 'The new commit'}
        </div>
        <CommitCard title={example.written} />
      </>
    )
  }

  private renderOtherLanguageNote() {
    const name = this.props.otherLanguage.trim()
    if (this.props.language !== 'other') {
      return null
    }
    return (
      <p className="commit-preview-note">
        {name === ''
          ? 'Name a language above; until then messages are written in English.'
          : `Shown in English; messages are written in ${name}.`}
      </p>
    )
  }
}
