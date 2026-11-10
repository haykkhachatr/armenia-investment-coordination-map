/* Guided tour + glue between the scroll story (story.js) and the tool (app.js). Uses window.ICP / window.STORY. */
(function () {
'use strict';
const X = window.ICP; if (!X) return;
const { state, P, OV } = X;
const $ = (s, el) => (el || document).querySelector(s);
const store = { get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} } };

Object.assign(window.I18N.hy, {
  tour_btn: 'Շրջայց', tour_next: 'Հաջորդը', tour_prev: 'Նախորդը', tour_done: 'Ավարտել',
  tour1_t: 'Բոլոր ծրագրերը՝ մեկ քարտեզի վրա', tour1_p: 'Յուրաքանչյուր նշան ծրագիր է։ Գույնը ուղղությունն է (ջուր, հող և բնություն, կլիմա), շեղանկյունը՝ պլանավորվող ծրագիր։ Տարվա սահողով տեսնում եք, թե ով ինչ է իրականացնում տվյալ տարում։',
  tour2_t: 'Ծրագրի քարտ', tour2_p: 'Սեղմեք ծրագրի վրա՝ դոնոր, բյուջե, վայրեր։ «Ամբողջական էջ»-ում՝ գործողություններ, արդյունքներ, աղբյուրներ և ստեղծված քարտեզները։',
  tour3_t: 'Պլանավորվող ծրագիր', tour3_p: 'Պլանավորվող ծրագրի քարտում երևում է՝ ինչ է նախատեսվում, բյուջեն, փուլը, և «ինչ արդեն կա այս վայրում»։ Սա հենց այն ստուգումն է, որ պետք է արվի ծրագիրը հաստատելուց առաջ։',
  tour4_t: 'Հնարավոր համընկնումներ', tour4_p: 'Նույն թեմա, նույն տարածք, միաժամանակյա ժամկետ։ Վարդագույն շտրիխը ցույց է տալիս համընկնող ամիսները։ Սա ազդանշան է համակարգման համար։',
  tour5_t: 'Կարիք և ծածկույթ', tour5_p: 'Շրջանները՝ ըստ բաց տվյալների ցուցիչի, համեմատած ծրագրերի քանակի հետ։ Աջ ներքևում՝ բարձր կարիք, բայց հաստատված ծրագիր չկա։',
  tour6_t: 'Քարտեզագրված տվյալներ', tour6_p: '60 իրական տվյալ՝ դեգրադացիա, աղակալում, կլիմա, վտանգներ։ Յուրաքանչյուրի համար՝ արտադրողը, հասանելիությունը և սահմանափակումները։'
});
Object.assign(window.I18N.en, {
  tour_btn: 'Tour', tour_next: 'Next', tour_prev: 'Back', tour_done: 'Finish',
  tour1_t: 'Every programme on one map', tour1_p: 'Each marker is a programme. Colour is the focus (water, land & nature, climate), a diamond is a planned programme. The year slider shows who is active when.',
  tour2_t: 'The programme card', tour2_p: 'Click a programme for donor, budget and places. The full page adds activities, results, sources and the maps it produced.',
  tour3_t: 'A planned programme', tour3_p: 'A planned programme’s card shows what is foreseen, the budget, the stage — and “what already exists here”. That is the check to run before approval.',
  tour4_t: 'Possible overlaps', tour4_p: 'Same theme, same area, overlapping dates. The pink hatch marks the overlapping months. It is a prompt for coordination.',
  tour5_t: 'Need vs. coverage', tour5_p: 'Districts by an open-data indicator against the number of programmes. Bottom right: high need, no confirmed programme.',
  tour6_t: 'Mapped data', tour6_p: '60 real datasets — degradation, salinity, climate, hazards — each with producer, access and limitations.'
});
const t = k => (window.I18N[state.lang] && window.I18N[state.lang][k]) || window.I18N.en[k] || k;
const showStory = () => { stopTour(true); window.STORY && window.STORY.show(); };
const hideStory = () => { store.set('icp_seen', '1'); window.STORY && window.STORY.hide(); };

// ------------------------------------------------------------ tour
let tourI = -1;
const quiet = h => { try { history.replaceState(null, '', h); } catch (e) {} };
function go(tab) { if (!$('#page').hidden) X.closePage(); X.setTab(tab); quiet('#/' + tab); }
function activeIn2026(o) { const f = +o.from.slice(0, 4), tt = +o.to.slice(0, 4); return f <= 2026 && tt >= 2026; }
const STEPS = [
  () => { go('map'); state.sel = null; state.themes.clear(); state.status.clear(); state.donors.clear(); state.marz = ''; state.q = ''; state.allYears = false; state.year = 2026; state.colorBy = 'count'; X.renderSideMap(); X.onFilterChange(); X.closeDrawer(); X.fitIds([]); },
  () => { go('map'); X.selectProject(X.BY['fao-gef-ldn-armenia'] ? 'fao-gef-ldn-armenia' : P[0].slug); },
  () => { go('map'); const pl = P.filter(p => p.eff === 'pipeline' && !p.is_national).sort((a, b) => (b.communities_specific.length + b.districts_specific.length) - (a.communities_specific.length + a.districts_specific.length))[0]; if (pl) { state.allYears = true; X.renderSideMap(); X.onFilterChange(); X.selectProject(pl.slug); } },
  () => { state.sub = 'overlaps'; go('coord'); const o = OV.filter(x => x.level === 'high' && activeIn2026(x))[0] || OV[0]; if (o) X.selectPair(o.a, o.b); },
  () => { state.sub = 'gaps'; go('coord'); X.closeDrawer(); X.renderSideCoord(); X.fitIds([]); },
  () => { go('data'); }
];
function renderTour() {
  const el = $('#tour'); if (tourI < 0) { el.hidden = true; return; }
  const n = STEPS.length, i = tourI + 1;
  el.hidden = false;
  el.innerHTML = '<button class="x" data-tour="stop" aria-label="' + X.esc(t('close')) + '">×</button><div class="tt">' + X.esc(t('tour' + i + '_t')) + '</div><p class="tp">' + X.esc(t('tour' + i + '_p')) + '</p>' +
    '<div class="tf"><div class="dots">' + STEPS.map((_, k) => '<i class="' + (k === tourI ? 'on' : '') + '"></i>').join('') + '</div>' +
    (tourI > 0 ? '<button class="btn" data-tour="prev">' + X.esc(t('tour_prev')) + '</button>' : '') +
    '<button class="btn primary" data-tour="' + (tourI === n - 1 ? 'stop' : 'next') + '">' + X.esc(tourI === n - 1 ? t('tour_done') : t('tour_next')) + '</button></div>';
}
function goTour(i) { tourI = Math.max(0, Math.min(STEPS.length - 1, i)); try { STEPS[tourI](); } catch (e) { console.error(e); } renderTour(); }
function startTour() { hideStory(); goTour(0); }
function stopTour(silent) { const was = tourI >= 0; tourI = -1; renderTour(); if (was && !silent) { if (state.colorBy !== 'count') state.colorBy = 'count'; if (state.tab !== 'map') go('map'); X.onFilterChange(); } }

document.addEventListener('click', e => {
  const h = e.target.closest('[data-hero]'), tr = e.target.closest('[data-tour]');
  if (h) {
    const a = h.dataset.hero; hideStory();
    if (a === 'tour') startTour(); else if (a === 'about') location.hash = '#/about'; else { location.hash = '#/' + a; if (state.tab !== a) X.route(); }
  } else if (tr) {
    const a = tr.dataset.tour; if (a === 'next') goTour(tourI + 1); else if (a === 'prev') goTour(tourI - 1); else stopTour();
  } else if (e.target.closest('#tourbtn')) { startTour(); }
  else if (e.target.closest('#brand')) { showStory(); }
  else if (e.target.closest('[data-lang]')) { setTimeout(() => { $('#t-tour').textContent = t('tour_btn'); if (window.STORY && window.STORY.isVisible()) window.STORY.render(); renderTour(); }, 0); }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.id === 'brand') showStory();
  if (e.key === 'Escape') { if (window.STORY && window.STORY.isVisible()) hideStory(); else if (tourI >= 0) stopTour(); }
});

// ------------------------------------------------------------ boot
$('#t-tour').textContent = t('tour_btn');
const skip = /[?&]intro=0/.test(location.search) || (location.hash || '').startsWith('#/project') || store.get('icp_seen');
if (!skip && window.STORY) window.STORY.show();
})();
