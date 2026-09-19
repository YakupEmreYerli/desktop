import * as Path from 'path'
import { watch } from 'fs'
import { readFile, rename, writeFile } from 'fs/promises'
import { getPath } from '../main-process-proxy'
import {
  DefaultRepositoryGroupsLayout,
  IRepositoryGroupsLayout,
  RepositoryGroupsFileName,
  parseRepositoryGroups,
  serializeRepositoryGroups,
} from '../../lib/repository-groups'

type Listener = (layout: IRepositoryGroupsLayout) => void

/**
 * The repository list layout, read from `repository-groups.json` and kept in
 * step with it: changes made by the `github group` commands (or by hand) show
 * up while the app is open, and changes made in the app are written back.
 */
class RepositoryGroupsStore {
  private layout = DefaultRepositoryGroupsLayout
  private contents: string | null = null
  private readonly listeners = new Set<Listener>()
  private started = false
  private reloadTimer: number | null = null
  private writing = Promise.resolve()

  public getLayout() {
    return this.layout
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    this.start()
    return () => this.listeners.delete(listener)
  }

  public update(
    change: (layout: IRepositoryGroupsLayout) => IRepositoryGroupsLayout
  ) {
    let next: IRepositoryGroupsLayout
    try {
      next = change(this.layout)
    } catch (e) {
      log.warn('Repository group change refused', e)
      return
    }
    const contents = serializeRepositoryGroups(next)
    this.contents = contents
    this.set(next)
    this.writing = this.writing
      .then(() => this.write(contents))
      .catch(e => log.error('Could not write the repository groups file', e))
  }

  private set(layout: IRepositoryGroupsLayout) {
    this.layout = layout
    this.listeners.forEach(l => l(layout))
  }

  private async getFilePath() {
    return Path.join(await getPath('userData'), RepositoryGroupsFileName)
  }

  private async start() {
    if (this.started) {
      return
    }
    this.started = true
    await this.reload()
    try {
      const path = await this.getFilePath()
      // Watch the directory: the file is replaced by a rename, which a watch
      // on the file itself would lose track of
      watch(Path.dirname(path), (_, filename) => {
        if (filename === RepositoryGroupsFileName) {
          this.scheduleReload()
        }
      })
    } catch (e) {
      log.error('Could not watch the repository groups file', e)
    }
  }

  private scheduleReload() {
    if (this.reloadTimer !== null) {
      window.clearTimeout(this.reloadTimer)
    }
    this.reloadTimer = window.setTimeout(() => {
      this.reloadTimer = null
      this.reload()
    }, 100)
  }

  private async reload() {
    let contents: string
    try {
      contents = await readFile(await this.getFilePath(), 'utf8')
    } catch {
      return
    }
    if (contents !== this.contents) {
      this.contents = contents
      this.set(parseRepositoryGroups(contents))
    }
  }

  private async write(contents: string) {
    const path = await this.getFilePath()
    await writeFile(`${path}.tmp`, contents, 'utf8')
    await rename(`${path}.tmp`, path)
  }
}

export const repositoryGroupsStore = new RepositoryGroupsStore()
