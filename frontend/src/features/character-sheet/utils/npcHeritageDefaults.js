/**
 * NPC heritage picks: required benefits/detriments default on, but stay toggleable.
 * Call when heritage catalog resolves; pass `seedRequired: false` after the first
 * apply for this npc+heritage so GM unchecks are not re-forced.
 */

function finiteIds(list) {
  return (list || [])
    .map((x) => Number(x))
    .filter((n) => Number.isFinite(n));
}

function idsEqual(a, b) {
  if (a.length !== b.length) return false;
  return a.every((id, i) => Number(id) === Number(b[i]));
}

/**
 * @param {number[]} prevBenefitIds
 * @param {number[]} prevDetrimentIds
 * @param {{ benefits?: Array<{id:number,required?:boolean}>, detriments?: Array<{id:number,required?:boolean}> } | null} heritageDetails
 * @param {{ seedRequired?: boolean }} [opts]
 * @returns {{ benefits: number[], detriments: number[], changed: boolean }}
 */
export function mergeNpcHeritageSelections(
  prevBenefitIds,
  prevDetrimentIds,
  heritageDetails,
  { seedRequired = true } = {},
) {
  if (!heritageDetails) {
    const benefits = finiteIds(prevBenefitIds);
    const detriments = finiteIds(prevDetrimentIds);
    return {
      benefits,
      detriments,
      changed:
        !idsEqual(benefits, prevBenefitIds || []) ||
        !idsEqual(detriments, prevDetrimentIds || []),
    };
  }

  const catalogB = heritageDetails.benefits || [];
  const catalogD = heritageDetails.detriments || [];
  const allowedB = new Set(
    catalogB.map((b) => Number(b.id)).filter((n) => Number.isFinite(n)),
  );
  const allowedD = new Set(
    catalogD.map((d) => Number(d.id)).filter((n) => Number.isFinite(n)),
  );
  const requiredB = catalogB
    .filter((b) => b?.required)
    .map((b) => Number(b.id))
    .filter((id) => allowedB.has(id));
  const requiredD = catalogD
    .filter((d) => d?.required)
    .map((d) => Number(d.id))
    .filter((id) => allowedD.has(id));

  const validB = finiteIds(prevBenefitIds).filter((id) => allowedB.has(id));
  const validD = finiteIds(prevDetrimentIds).filter((id) => allowedD.has(id));

  const benefits = seedRequired
    ? [...new Set([...requiredB, ...validB])]
    : validB;
  const detriments = seedRequired
    ? [...new Set([...requiredD, ...validD])]
    : validD;

  return {
    benefits,
    detriments,
    changed:
      !idsEqual(benefits, prevBenefitIds || []) ||
      !idsEqual(detriments, prevDetrimentIds || []),
  };
}

export function npcHeritageDefaultsKey(npcId, heritageId) {
  if (heritageId == null || heritageId === "") return null;
  return `${npcId ?? "new"}:${heritageId}`;
}
