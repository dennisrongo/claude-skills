import { buildReport } from './aggregate.mjs'
import { installedPlugins, locateLocalSkill, readKeep, readSettingsStrict } from './inventory.mjs'
import { readProbeIds, writeReport } from './state.mjs'
import { readSessions } from './transcripts.mjs'

export const scan = async (options = {}) => {
  const keep = readKeep()
  const settings = readSettingsStrict()
  const { sessions, skippedFiles } = await readSessions({ exclude: new Set(readProbeIds()) })
  const report = buildReport({
    sessions,
    skippedFiles,
    plugins: installedPlugins(),
    settings,
    keep,
    options,
    locate: locateLocalSkill,
  })
  writeReport(report)
  return report
}
