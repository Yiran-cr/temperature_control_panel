/**
 * 温度显示配色（纯展示用途）
 *
 * 按温度高低映射到颜色，仅服务 UI 视觉，不参与任何业务判定。
 * 阈值均收敛在本模块单点定义，禁止在组件里再写死。
 */
const DISPLAY_WARM = 8; // ≥ 8°C 视为偏热（红）
const DISPLAY_MID = 4; // ≥ 4°C 视为正常偏暖
const DISPLAY_COOL = 1; // ≥ 1°C 视为正常偏凉

/** 温度值 → 展示配色 */
export function toDisplayColor(value: number): string {
  if (value >= DISPLAY_WARM) return '#ff3860'; // 高温红
  if (value >= DISPLAY_MID) return '#a8e6ff'; // 正常
  if (value >= DISPLAY_COOL) return '#7dd8ff'; // 偏凉
  return '#5fd0ff'; // 低温冰蓝
}
