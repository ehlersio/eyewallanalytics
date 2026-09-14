// src/components/TradeTree.jsx
// One NHL trade's tree, opened from a trade in the Transactions feed
// (TransactionsFeed.jsx): what each team received, and for every asset that
// was traded again, what its new team got back for it -- recursively, as far
// as the Worker's /trades/tree route walked. eyewall-pipeline's
// trade_trees.py builds the links nightly from ESPN's trade text and the
// NHL's own draft records: picks show the player they became once drafted,
// and a pick that can't be traced is labeled, never guessed. "How they got
// here" lists the earlier trades that brought in what this trade sent out.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getTradeTree } from '../utils/nhlApi';
import { formatDate } from '../utils/formatters';
import { capture } from '../utils/analytics';
import TeamLogo from './TeamLogo';

const K = 'transactionsFeed.nhl.tree';
const MUTED = 'text-[color:var(--text-muted)]';
const DIM = 'text-[color:var(--text-dim)]';
const HEADER_CLASSES = 'flex items-center gap-1.5 text-[12px] font-semibold text-[color:var(--text)] mb-1';
const STATUS_CLASSES = `tree-status text-[12px] italic ${DIM} mt-2`;

function treeDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T00:00:00`);
  if (isNaN(d)) return dateStr;
  return formatDate(d, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function assetLabel(asset, t) {
  if (asset.type === 'player') {
    const name = [asset.position, asset.name].filter(Boolean).join(' ');
    return asset.rights ? `${name} (${t(`${K}.rights`)})` : name;
  }
  if (asset.type === 'pick') {
    const p = asset.pick || {};
    const year = p.year ?? p.resolvedYear;
    let label;
    if (year && p.round) label = t(`${K}.pick`, { year, round: p.round });
    else if (p.round) label = t(`${K}.pickNoYear`, { round: p.round });
    else label = t(`${K}.pickVague`);
    return p.conditional ? `${label} ${t(`${K}.conditional`)}` : label;
  }
  if (asset.type === 'future_considerations') return t(`${K}.futureConsiderations`);
  if (asset.type === 'cash') return t(`${K}.cash`);
  return asset.raw || '?';
}

function pickOutcome(asset, t) {
  const p = asset.pick;
  if (!p) return null;
  if (p.resolvedOverall) {
    return p.draftedName
      ? t(`${K}.drafted`, { overall: p.resolvedOverall, name: p.draftedName })
      : t(`${K}.draftedNoName`, { overall: p.resolvedOverall });
  }
  return p.note ? t(`${K}.note.${p.note}`) : null;
}

function AssetList({ assets, tree, path }) {
  const { t } = useTranslation();
  if (!assets.length) return <div className={`text-[12px] italic ${DIM}`}>{t(`${K}.nothingListed`)}</div>;
  return (
    <ul className="tree-assets list-none m-0 p-0 flex flex-col gap-1">
      {assets.map((a, i) => <AssetItem key={i} asset={a} tree={tree} path={path} />)}
    </ul>
  );
}

function AssetItem({ asset, tree, path }) {
  const { t } = useTranslation();
  const outcome = pickOutcome(asset, t);
  const next = asset.next ? tree.trades[asset.next] : null;
  return (
    <li className="tree-asset text-[13px] leading-[1.4] text-[color:var(--text)]">
      <span>{assetLabel(asset, t)}</span>
      {outcome && <span className={`${MUTED} text-[12px]`}> · {outcome}</span>}
      {asset.next && !next && <div className={`text-[12px] ${DIM} pl-3`}>↳ {t(`${K}.notShown`)}</div>}
      {next && <Continuation trade={next} team={asset.to} tree={tree} path={path} />}
    </li>
  );
}

// `team` traded the asset away in `trade`; show what it got back.
function Continuation({ trade, team, tree, path }) {
  const { t } = useTranslation();
  const other = trade.teams.find(x => x !== team) || '';
  const got = trade.sides.find(s => s.team === team)?.received || [];
  return (
    <div className="tree-next mt-1 pl-3 border-l-2 border-[var(--border-2)]">
      <div className={`text-[12px] ${MUTED}`}>↳ {t(`${K}.then`, { date: treeDate(trade.date), team: other })}</div>
      {path.includes(trade.id)
        ? <div className={`text-[12px] ${DIM}`}>{t(`${K}.seeAbove`)}</div>
        : <AssetList assets={got} tree={tree} path={[...path, trade.id]} />}
    </div>
  );
}

export default function TradeTree({ txId }) {
  const { t } = useTranslation();
  const [state, setState] = useState({ loading: true, data: null });

  useEffect(() => {
    let live = true;
    setState({ loading: true, data: null });
    getTradeTree(txId).then(data => { if (live) setState({ loading: false, data }); });
    return () => { live = false; };
  }, [txId]);

  // What the viewer actually got: a tree (and how big), not-found, or down.
  useEffect(() => {
    const tree = state.data;
    if (state.loading) return;
    capture('feature_viewed', {
      feature: 'trade_tree',
      found: !!tree?.found,
      unavailable: !tree || !!tree.unavailable,
      trades: Object.keys(tree?.trades || {}).length,
      origins: (tree?.origins || []).length,
      truncated: !!tree?.truncated,
    });
  }, [state]);

  if (state.loading) return <div className={STATUS_CLASSES}>{t(`${K}.loading`)}</div>;
  const tree = state.data;
  if (!tree || tree.unavailable) return <div className={STATUS_CLASSES}>{t(`${K}.unavailable`)}</div>;
  const root = tree.found ? tree.trades?.[tree.root] : null;
  if (!root) return <div className={STATUS_CLASSES}>{t(`${K}.notFound`)}</div>;

  const originLines = (tree.origins || []).flatMap(o => o.assets.map(a => ({ o, a })));
  return (
    <div className="trade-tree mt-2 pt-2 border-t border-[var(--border-2)] flex flex-col gap-2.5">
      {root.sides.map(side => (
        <section key={side.team} className="tree-side">
          <div className={HEADER_CLASSES}>
            <TeamLogo abbr={side.team} size={16} /> {t(`${K}.received`, { team: side.team })}
          </div>
          <AssetList assets={side.received} tree={tree} path={[root.id]} />
        </section>
      ))}
      {originLines.length > 0 && (
        <section className="tree-origins">
          <div className={HEADER_CLASSES}>{t(`${K}.origins`)}</div>
          <ul className="list-none m-0 p-0 flex flex-col gap-0.5">
            {originLines.map(({ o, a }, i) => (
              <li key={i} className={`text-[12px] ${MUTED}`}>
                {t(`${K}.originLine`, { asset: assetLabel(a, t), to: a.to, from: a.from, date: treeDate(o.date) })}
              </li>
            ))}
          </ul>
        </section>
      )}
      {tree.truncated && <div className={`text-[11px] italic ${DIM}`}>{t(`${K}.truncated`)}</div>}
      <div className={`text-[10px] italic ${DIM}`}>{t(`${K}.source`)}</div>
    </div>
  );
}
