#!/usr/bin/with-contenv bashio
# shellcheck shell=bash
# ==============================================================================
# Home Assistant Add-on: ShareIo
# Validates the configuration, creates the server secret and the database
# ==============================================================================
readonly DATABASE=shareio
readonly SECRET_FILE=/data/server_secret
declare host
declare port
declare username
declare password
declare override
declare property

# --- SERVER SECRET ---
# Generated once and kept in the add-on data unless one is configured.
if bashio::config.is_empty 'server_secret' && [[ ! -s "${SECRET_FILE}" ]]; then
    bashio::log.info 'Generating a server secret...'
    (umask 077 && head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n' > "${SECRET_FILE}")
fi

# --- VALIDATE SERVER OVERRIDES ---
# One "property=value" per entry. Some properties are protected because
# changing them would break Home Assistant login, file storage or security.
if bashio::config.has_value 'server_overrides'; then
    while IFS= read -r override; do
        [[ -z "${override}" ]] && continue
        property="${override%%=*}"
        if [[ ${property} =~ ^sharry[.]restserver[.](backend[.]auth[.](command|proxy)|backend[.]files|bind)([.]|$) ]]; then
            bashio::log.fatal
            bashio::log.fatal "The server override '${property}' is not allowed."
            bashio::log.fatal "Changing it would break Home Assistant login, file storage"
            bashio::log.fatal "or let others log in as any user. Remove it and try again."
            bashio::log.fatal
            bashio::exit.nok
        fi
    done < <(bashio::config 'server_overrides')
fi

# --- SET UP DATABASE ---
bashio::log.debug 'Setting up database.'
# Use user-provided remote db
if ! bashio::config.is_empty 'remote_db_host'; then
    bashio::config.require 'remote_db_type' "'remote_db_host' is specified"
    bashio::config.require 'remote_db_database' "'remote_db_host' is specified"
    bashio::config.require 'remote_db_username' "'remote_db_host' is specified"
    bashio::config.require 'remote_db_password' "'remote_db_host' is specified"
    bashio::config.require 'remote_db_port' "'remote_db_host' is specified"

    host=$(bashio::config 'remote_db_host')
    port=$(bashio::config 'remote_db_port')
    bashio::log.info "Using remote database at ${host}:${port}"

    # Wait until db is available.
    connected=false
    for _ in {1..30}; do
        if nc -w1 "${host}" "${port}" > /dev/null 2>&1; then
            connected=true
            break
        fi
        sleep 1
    done

    if [ $connected = false ]; then
        bashio::log.fatal
        bashio::log.fatal "Cannot connect to remote database at ${host}:${port}!"
        bashio::log.fatal "Exiting after retrying for 30 seconds."
        bashio::log.fatal
        bashio::log.fatal "Please ensure the config is set correctly and"
        bashio::log.fatal "the database is available at the specified host and port."
        bashio::log.fatal
        bashio::exit.nok
    fi

# Use mysql service provided by supervisor
else
    if ! bashio::services.available 'mysql'; then
        bashio::log.fatal
        bashio::log.fatal 'MariaDB addon not available and no alternate database supplied'
        bashio::log.fatal 'Ensure MariaDB addon is available or provide an alternate database'
        bashio::log.fatal
        bashio::exit.nok
    fi

    host=$(bashio::services 'mysql' 'host')
    port=$(bashio::services 'mysql' 'port')
    username=$(bashio::services 'mysql' 'username')
    password=$(bashio::services 'mysql' 'password')

    bashio::log.notice "ShareIo is using the Maria DB addon's database"
    bashio::log.notice "Please ensure that addon is included in your backups"
    bashio::log.notice "Uninstalling the Maria DB addon will also remove ShareIo's data"

    if bashio::config.true 'reset_database'; then
        bashio::log.warning 'Resetting database...'
        echo "DROP DATABASE IF EXISTS \`${DATABASE}\`;" \
            | mysql -h "${host}" -P "${port}" -u "${username}" -p"${password}"

        # Remove `reset_database` option
        bashio::addon.option 'reset_database'
    fi

    # Create database if it doesn't exist
    echo "CREATE DATABASE IF NOT EXISTS \`${DATABASE}\`;" \
        | mysql -h "${host}" -P "${port}" -u "${username}" -p"${password}"
fi
