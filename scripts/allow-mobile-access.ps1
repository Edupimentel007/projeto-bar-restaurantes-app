# Execute este arquivo como Administrador para permitir que celulares da
# mesma rede privada acessem o servidor local do Bar do Nardo.

$ruleName = "BarDoNardo-3333"
$existingRule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue

if ($existingRule) {
  Set-NetFirewallRule -DisplayName $ruleName -Enabled True -Profile Private -Direction Inbound -Action Allow
  Write-Host "Regra existente ativada: $ruleName"
  exit 0
}

New-NetFirewallRule `
  -DisplayName $ruleName `
  -Description "Acesso mobile ao cardapio e painel local do Bar do Nardo" `
  -Direction Inbound `
  -Action Allow `
  -Protocol TCP `
  -LocalPort 3333 `
  -Profile Private | Out-Null

Write-Host "Acesso mobile liberado na porta 3333 para redes privadas."
