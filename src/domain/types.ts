export type Pitch = "high" | "low";

export type Duration = "w" | "h" | "q" | "8" | "16" | "32";

export type NoteItem = {
  kind: "note";
  /** パターン内で一意。譜面のハイライトと再生イベントを結ぶ鍵 */
  id: string;
  duration: Duration;
  dots?: 0 | 1;
  pitch: Pitch;
};

export type RestItem = {
  kind: "rest";
  duration: Duration;
  dots?: 0 | 1;
};

export type NotationItem = NoteItem | RestItem;

/** items[from..to]（両端含む）を num:den の連符にする */
export type Tuplet = {
  from: number;
  to: number;
  num: number;
  den: number;
};

export type Bar = {
  items: NotationItem[];
  tuplets?: Tuplet[];
  /** 明示的な連桁グループ。省略時は beatGroups から自動算出する */
  beams?: Array<[number, number]>;
};

/** 出典は種別ごとに構造を変える（文字列1本では追跡できないため） */
export type SourceLocator =
  | { type: "primary"; person: string; role: string; place?: string }
  | { type: "oral"; person: string; role: string; place?: string; occasion?: string }
  | { type: "publication"; title: string; author?: string; page?: string; isbn?: string; url?: string }
  | { type: "recording"; title: string; artist?: string; timecode?: string; url?: string };

export type SourceMeta = {
  locator: SourceLocator;
  transcribedBy: string;
  verifiedBy?: string;
  /** YYYY-MM-DD */
  confirmedOn: string;
  arrangementNotes?: string;
};

export type Meter = {
  beats: number;
  beatUnit: 2 | 4 | 8;
  /** 拍のグループ分け。6/8 の「3+3」なら [3, 3]。合計は beats と一致する */
  beatGroups: number[];
};

export type Pattern = {
  id: string;
  name: string;
  meter: Meter;
  /** BPM の1拍が何 tick か。4/4 なら 96、6/8 なら 144（付点4分） */
  bpmUnit: number;
  bars: Bar[];
  source: SourceMeta;
  /**
   * 打点がクラーベの形をしていることを示す。**3:2 ⇄ 2:3 の入れ替えを許す印。**
   *
   * **根拠のあるものにだけ立てる。** 2小節を入れ替える操作自体はどのリズムにも
   * できるが、「3:2 / 2:3」はクラーベの用語なので、形が違うリズムに当てると
   * アプリが根拠のないことを主張することになる。
   * 立てる前に `source` に確認の記録があることを確かめる。
   */
  clave?: "3-2";
};

export type PlaybackEvent = {
  noteId: string;
  /** パターン先頭からの絶対 tick */
  tick: number;
  pitch: Pitch;
};
