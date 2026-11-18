import {legacyRoofFloorOf} from './buildingModules'
import type {ProjectConfig} from './model'

/** Only append/truncate at the top: existing numeric floor identities stay fixed. */
export function configWithLevels(config:ProjectConfig,levels:NonNullable<ProjectConfig['levels']>):ProjectConfig{
 const next={...config,levels},roof=legacyRoofFloorOf(config)
 if(roof!==undefined&&roof<=levels.length){next.hasRoof=true;next.legacyRoofFloor=roof;next.floors=levels.length-1}
 else{next.floors=levels.length;if(config.hasRoof)next.hasRoof=false;delete next.legacyRoofFloor}
 return next
}
