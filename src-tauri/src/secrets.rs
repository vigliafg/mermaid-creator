const SERVICE: &str = "mermaid-creator";
const USER: &str = "openrouter";

fn entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(SERVICE, USER).map_err(|e| format!("Keyring non disponibile: {e}"))
}

pub fn set_key(key: &str) -> Result<(), String> {
    entry()?
        .set_password(key)
        .map_err(|e| format!("Salvataggio nel keyring fallito: {e}"))
}

pub fn get_key() -> Result<Option<String>, String> {
    match entry()?.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("Lettura dal keyring fallita: {e}")),
    }
}

pub fn delete_key() -> Result<(), String> {
    match entry()?.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("Rimozione dal keyring fallita: {e}")),
    }
}

pub fn mask(key: &str) -> String {
    if key.len() <= 10 {
        return "••••".into();
    }
    format!("{}…{}", &key[..6], &key[key.len() - 4..])
}
