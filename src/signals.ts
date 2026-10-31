/**
 * 目镜面板（望远镜）里展示的一条内容：编号、标题、正文与标签。
 * 探索星座的每颗星、以及世界里的信号面，都用这一份结构承载文案。
 */
export type SignalCopy = {
  index: string;
  label: string;
  title: string;
  body: string;
  tags: readonly string[];
};
