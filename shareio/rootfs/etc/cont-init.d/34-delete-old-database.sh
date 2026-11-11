#!/usr/bin/with-contenv bashio
# shellcheck shell=bash
# ==============================================================================
# Home Assistant Add-on: ShareIo
# Optional, one-shot (option "delete_old_sharry_database"): deletes the 'sharry'
# database left behind in the MariaDB add-on by the older Sharry add-on,
# including all shares and files stored in it. ShareIo's own 'shareio'
# database is never touched. The option switches itself off afterwards.
# ==============================================================================
bashio::config.true 'delete_old_sharry_database' || exit 0
bashio::config.is_empty 'remote_db_host' || {
    bashio::log.warning 'Deleting the old Sharry database only works with the MariaDB add-on; skipped.'
    bashio::addon.option 'delete_old_sharry_database'
    exit 0
}

host=$(bashio::services 'mysql' 'host')
port=$(bashio::services 'mysql' 'port')
username=$(bashio::services 'mysql' 'username')
password=$(bashio::services 'mysql' 'password')

sql() {
    MYSQL_PWD="${password}" mariadb -h "${host}" -P "${port}" -u "${username}" \
        --batch --skip-column-names "$@"
}

if [[ -z "$(sql -e "SHOW DATABASES LIKE 'sharry';")" ]]; then
    bashio::log.info "No old 'sharry' database found; nothing to delete."
else
    size=$(sql -e "SELECT ROUND(COALESCE(SUM(data_length + index_length), 0) / 1048576)
                   FROM information_schema.tables WHERE table_schema = 'sharry';")
    bashio::log.warning "Deleting the old 'sharry' database (${size} MB) left by the older Sharry add-on..."
    if sql -e 'DROP DATABASE `sharry`;'; then
        bashio::log.notice "Old 'sharry' database deleted; about ${size} MB freed in MariaDB."
    else
        bashio::log.error "Could not delete the old 'sharry' database; see the MariaDB add-on log."
    fi
fi

# One-shot: switch the option off again
bashio::addon.option 'delete_old_sharry_database'
