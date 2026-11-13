import { axisNumber, floorNameOf, moduleKey, type LayoutPosition, type ProjectConfig } from '../common/model'
import type { ModuleDimensions } from '../common/moduleGeometry'
import { ModuleDimensionsEditor } from './ModuleDimensionsEditor'
import styles from '../views/ProductionBoard.module.css'

interface Props {
  position: LayoutPosition | null; config: ProjectConfig; generalHeight: number; count: number; busy: boolean
  onSave: (dimensions: ModuleDimensions) => Promise<boolean>; onDirtyChange: (dirty: boolean) => void
}
export function DraftModuleDetail({ position, config, generalHeight, count, busy, onSave, onDirtyChange }: Props) {
  return <aside className={styles.draftDetail} aria-label="배치 초안 치수 설정">
    <span className={styles.eyebrow}>LAYOUT DRAFT</span>
    <h2>{position ? `${floorNameOf(position.floor, config)} · X${axisNumber(position.x)} Y${axisNumber(position.y)}` : '배치 초안 작성 중'}</h2>
    <p>{position ? '이 위치의 모듈 치수를 설정하세요. 저장한 치수와 기준 모서리는 최종 배치 확정 후에도 유지됩니다.' : '배치된 칸을 선택하면 개별 폭·깊이·높이와 기준 모서리를 설정할 수 있습니다.'}</p>
    {position && <ModuleDimensionsEditor key={moduleKey(position.floor, position.x, position.y)} module={{ ...position, key: moduleKey(position.floor, position.x, position.y) }} config={config} generalHeight={generalHeight} busy={busy} otherDirty={false} defaultOpen onSave={onSave} onDirtyChange={onDirtyChange} />}
    <div className={styles.draftDetailStats}><span>배치 예정</span><b>{count}개</b><span>기준 모듈</span><b>{config.width} × {config.depth} m</b></div>
    <p>변경사항은 저장할 때 서버에 보관됩니다. 최종 확정하면 모듈번호가 부여되고 관리계획을 입력할 수 있습니다.</p>
  </aside>
}
