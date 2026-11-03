// A review is a "not working" report when it says the extension stopped working.
// STRONG patterns are explicit failure statements; WEAK ones are generic complaint words that only count
// together with a low rating, since they often describe unrelated problems.
const STRONG = [
  /\b(doesn'?t|does not|don'?t|do not|no longer|stopped|not|isn'?t|won'?t|can'?t|cannot)\b.{0,25}\b(work|working|works|download|load|loading|show|appear)/i,
  /(안\s?돼|안\s?됩|안\s?되|동작\s?(안|하지)|작동\s?(안|하지)|더\s?이상|먹통|실행\s?안|다운\s?(안|이\s?안))/,
  /(動かない|動作しない|使えない|ダウンロードできない)/,
  /(不能用|无法下载|無法下載|失效|不工作|用不了)/,
];
const WEAK = [
  /\b(broken|broke|useless|dead|bug|buggy|error|fails?|failed|failing)\b/i,
  /(오류|에러|고장)/,
  /(エラー|壊れ)/,
];

export function classify(review) {
  const text = review.text ?? '';
  if (STRONG.some((p) => p.test(text)) && review.rating <= 3) return { broken: true, reason: 'explicit failure statement' };
  if (WEAK.some((p) => p.test(text)) && review.rating <= 2) return { broken: true, reason: 'failure keyword with low rating' };
  return { broken: false, reason: null };
}
