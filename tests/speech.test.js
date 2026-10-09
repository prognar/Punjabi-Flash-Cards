global.window = global; 
require('../data/content.js'); require('../js/model.js'); require('../js/speech.js');
const S = window.SPEECH, M = window.MODEL;
const it = id => M.items[id];
const cases = [
  ['ਗੇਂਦ', 'v-ball', true], ['gained', 'v-ball', true], ['gand', 'v-ball', true],
  ['sat sri akal', 'p-hello-anytimeofday', true],
  ['ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ', 'p-hello-anytimeofday', true],
  ['set three a call', 'p-hello-anytimeofday', null],
  ['ਮੈਨੂੰ ਭੁੱਖ ਲੱਗੀ ਆ', 'p-i-am-hungry', true], ['ਮੈਨੂੰ ਭੁੱਖ ਲੱਗੀ ਹੈ', 'p-i-am-hungry', true],
  ['ਪਾਣੀ', 'p-water', true], ['ਘਰ', 'p-water', false], ['banana', 'v-ball', false],
  ['ਕੱਕਾ', 'l6', true], ['kakka', 'l6', true], ['ਗੱਗਾ', 'l6', false],
  ['ਬਿੱਲੀ', 'v-cat', true], ['billy', 'v-cat', true], ['ਕੁੱਤਾ', 'v-cat', false],
  ['ਧੰਨਵਾਦ ਜੀ', 'p-thank-you', true], ['dhanyavad', 'p-thank-you', true],
];
let fail = 0;
for (const [heard, id, expect] of cases) {
  if (!it(id)) { console.log('MISSING', id); fail++; continue; }
  const s = S.scoreHeard(heard, it(id));
  const ok = s >= 0.6;
  const flag = expect === null ? 'info' : (ok === expect ? 'ok' : 'FAIL');
  if (flag === 'FAIL') fail++;
  console.log(flag.padEnd(5), s.toFixed(2), heard, '→', id, '|', S.key(heard), 'vs', it(id).romAnswers.map(S.key).join(','));
}
console.log('deva', S.gurToDeva('ਮੈਨੂੰ ਭੁੱਖ ਲੱਗੀ ਆ'), S.gurToDeva('ਸ਼ਾਮ'), S.gurToDeva('ਘੋੜਾ'));
console.log('lat', S.gurToLatin('ਕਿਤਾਬ'), S.gurToLatin('ਘਰ'), S.gurToLatin('ਸ਼ੁਰੂ'));
console.log('lessons', M.lessons.length, M.lessons.map(L=>[L.letter.length,L.vocab.length,L.phrase.length].join('/')).join(' '));
process.exit(fail ? 1 : 0);
