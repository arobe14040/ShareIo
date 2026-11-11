#!/usr/bin/with-contenv bashio
# shellcheck shell=bash
# ==============================================================================
# Home Assistant Add-on: ShareIo
# Optional, read-only database report (option "database_report"). Writes the
# size of each database and the shares and files in ShareIo's database and in
# a database left behind by the older Sharry add-on to the log, then switches
# the option off again. Nothing is changed. Credentials never leave the add-on.
# ==============================================================================
bashio::config.true 'database_report' || exit 0
# Informational only: a failed query must never stop the add-on from starting.
set +o errexit +o pipefail
bashio::config.is_empty 'remote_db_host' || {
    bashio::log.warning 'Database report only works with the MariaDB add-on; skipped.'
    bashio::addon.option 'database_report'
    exit 0
}

host=$(bashio::services 'mysql' 'host')
port=$(bashio::services 'mysql' 'port')
username=$(bashio::services 'mysql' 'username')
password=$(bashio::services 'mysql' 'password')

sql() {
    MYSQL_PWD="${password}" mariadb -h "${host}" -P "${port}" -u "${username}" \
        --batch --skip-column-names "$@" 2>&1
}
log_rows() {
    local line
    while IFS= read -r line; do
        # Skip client notices that are not part of the report
        [[ "${line}" == *"Deprecated program name"* || "${line}" == *"ssl-verify-server-cert"* ]] && continue
        bashio::log.info "  ${line//$'\t'/  |  }"
    done
}

bashio::log.info '========== ShareIo database report (read-only) =========='
bashio::log.info 'Database sizes (MB):'
sql -e "SELECT table_schema, ROUND(SUM(data_length + index_length) / 1048576)
        FROM information_schema.tables
        GROUP BY table_schema ORDER BY 2 DESC;" | log_rows

db_exists() {
    # Count only; client notices on stderr must not count as a result.
    [[ "$(MYSQL_PWD="${password}" mariadb -h "${host}" -P "${port}" -u "${username}" \
        --batch --skip-column-names \
        -e "SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name = '$1';" 2>/dev/null)" == 1 ]]
}

for db in sharry shareio; do
    db_exists "${db}" || continue
    bashio::log.info "---------- Database '${db}' ----------"
    bashio::log.info 'Shares (name | owner | created | files | expected size):'
    sql "${db}" -e "SELECT COALESCE(s.name_, CONCAT('(unnamed) ', LEFT(s.id, 8))),
                           a.login, LEFT(s.created, 19), COUNT(sf.id),
                           COALESCE(SUM(sf.real_size), 0)
                    FROM share s JOIN account_ a ON a.id = s.account_id
                    LEFT JOIN share_file sf ON sf.share_id = s.id
                    GROUP BY s.id ORDER BY s.created;" | log_rows
    # ShareIo keeps file contents on disk; only the old database stores them here.
    [[ "${db}" == sharry ]] || continue
    bashio::log.info 'Files (name | expected bytes | bytes stored in database | status):'
    sql "${db}" -e "SELECT sf.filename, sf.real_size,
                           COALESCE(c.stored, 0),
                           IF(COALESCE(c.stored, 0) < sf.real_size,
                              'INCOMPLETE', 'complete')
                    FROM share_file sf
                    LEFT JOIN (SELECT file_id, SUM(chunk_len) AS stored
                               FROM filechunk GROUP BY file_id) c
                           ON c.file_id = sf.file_id
                    ORDER BY sf.created;" | log_rows
    bashio::log.info 'Stored data not linked to any share (files | MB):'
    sql "${db}" -e "SELECT COUNT(DISTINCT file_id), ROUND(COALESCE(SUM(chunk_len), 0) / 1048576)
                    FROM filechunk
                    WHERE file_id NOT IN (SELECT file_id FROM share_file);" | log_rows
done
bashio::log.info '========== End of database report =========='

# One-shot: switch the option off again
bashio::addon.option 'database_report'
