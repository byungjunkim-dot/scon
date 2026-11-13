import { moduleGeometryOf } from '../../common/moduleGeometry'
import { moduleKindOf } from '../../common/buildingModules'
import { isStageOmitted, totalFloorsOf, floorNameOf, actualStageDateOf, currentPlanOf, moduleNumber, type ProjectDetail } from '../../common/model'
import type { InstallationScene } from './scene'

/** The only renderer adapter that knows this app's domain model. No writes or API. */
export function installationSceneOf(project: ProjectDetail): InstallationScene {
  return {
    ...project.config, floors: totalFloorsOf(project.config),
    floorLabels: Object.fromEntries(Array.from({ length: totalFloorsOf(project.config) }, (_, i) => [i+1, floorNameOf(i+1, project.config)])),
    modules: project.modules.filter(m => m.active).map(m => ({
      key: m.key, kind:moduleKindOf(m,project.config), number: moduleNumber(m, project.config), ...moduleGeometryOf(m, project.config, project.installation3d), floor: m.floor, x: m.x, y: m.y,
      plannedDate: currentPlanOf(m).installationDate,
      actualDate: actualStageDateOf(m, 'installation') || '',
      omitted:isStageOmitted(m.currentPlan,'installation'),
    })),
  }
}
