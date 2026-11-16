// Traduit une erreur Supabase / PostgREST en message compréhensible, avec
// l'action à faire quand il s'agit d'une migration SQL pas encore appliquée
// (cas le plus fréquent après un déploiement : « colonne introuvable »).
const MIGRATION_HINTS = [
  { re: /scheduled_time|duration_minutes|planning_updated/i, file: '0015_menuiserie_planning.sql' },
  { re: /latitude|longitude|geocode/i, file: '0016_menuiserie_geolocalisation.sql' },
  { re: /cancelled/i, file: '0013_menuiserie_annulation.sql' },
  { re: /devis_valide/i, file: '0012_menuiserie_devis_valide.sql' },
  { re: /received_date/i, file: '0011_menuiserie_date_reception.sql' },
  { re: /is_urgent/i, file: '0010_menuiserie_urgent.sql' },
  { re: /category/i, file: '0009_menuiserie_categories.sql' },
  { re: /billing_status|relances|invoice_number|billed_date/i, file: '0007_menuiserie_facturation_relances.sql' },
];

export const describeDbError = (error) => {
  const msg = (error && (error.message || error.details)) || (typeof error === 'string' ? error : '') || '';
  const code = (error && error.code) || '';
  if (code === 'PGRST204' || /could not find the '[^']*' column|column .* does not exist|schema cache/i.test(msg)) {
    const hint = MIGRATION_HINTS.find((h) => h.re.test(msg));
    return hint
      ? `colonne manquante en base : exécute la migration ${hint.file} dans le SQL Editor Supabase, puis recharge. (${msg})`
      : `colonne manquante en base, une migration SQL doit être appliquée. (${msg})`;
  }
  if (/row-level security|permission denied|policy/i.test(msg)) {
    return `accès refusé par la base (droits de ce compte). (${msg})`;
  }
  if (/violates check constraint/i.test(msg)) {
    return `valeur refusée par la base (contrainte). (${msg})`;
  }
  if (!msg || /Failed to fetch|NetworkError|network|timeout|abort/i.test(msg)) {
    return 'connexion impossible, vérifie le réseau.';
  }
  return msg;
};
