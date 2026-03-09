# ===== AIOX + CLAUDE CODE CUSTOMIZATIONS =====

export AIOX_COLOR_PRIMARY="#D1FF00"
export AIOX_COLOR_ACCENT="#A3FF00"
export AIOX_ROLE="dev"
export AIOX_ENV="dev"

# Quick commands
alias aiox-dev="aiox run dev --agent=dev"
alias aiox-arch="aiox run --agent=architect"
alias aiox-pm="aiox run --agent=pm"
alias aiox-analyst="aiox run --agent=analyst"
alias aiox-status="aiox status --dev"
alias aiox-cost="aiox report --type=cost --session"
alias aiox-context="aiox context --verbose"
alias aiox-agents="aiox agents --active"
alias gs="git status"
alias gl="git log --oneline -10"

# Trocar ambiente
switch-env() {
    case "$1" in
        dev) export AIOX_ENV="dev"; echo "✅ DEV (🟢)" ;;
        staging) export AIOX_ENV="staging"; echo "⚠️  STAGING (🟡)" ;;
        prod) export AIOX_ENV="production"; echo "🚨 PROD (🔴)" ;;
        *) echo "Uso: switch-env {dev|staging|prod}" ;;
    esac
}

# Trocar role
switch-role() {
    case "$1" in
        dev) export AIOX_ROLE="dev"; echo "👨‍💻 DEV" ;;
        arch) export AIOX_ROLE="architect"; echo "🏗️  ARCHITECT" ;;
        pm) export AIOX_ROLE="pm"; echo "📊 PM" ;;
        analyst) export AIOX_ROLE="analyst"; echo "📈 ANALYST" ;;
        *) echo "Uso: switch-role {dev|arch|pm|analyst}" ;;
    esac
}
