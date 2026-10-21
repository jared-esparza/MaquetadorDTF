!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Bienvenido a Maquetador DTF"
  !define MUI_WELCOMEPAGE_TEXT "Este asistente instalará Maquetador DTF de PKprint en tu equipo.$\r$\n$\r$\nNo necesitas instalar Node.js ni tener conexión a Internet.$\r$\n$\r$\nPulsa Siguiente para continuar."
  !insertmacro MUI_PAGE_WELCOME
!macroend

!ifndef BUILD_UNINSTALLER
!include nsDialogs.nsh
Var DTFShortcutCheckbox
Var DTFCreateShortcut

!macro customInit
  StrCpy $DTFCreateShortcut ${BST_CHECKED}
!macroend

!macro customPageAfterChangeDir
  Page custom DTFOptionsPage DTFOptionsLeave

Function DTFOptionsPage
  ${If} ${Silent}
    Return
  ${EndIf}
  !insertmacro MUI_HEADER_TEXT "Accesos directos" "Elige cómo abrir Maquetador DTF."
  nsDialogs::Create 1018
  Pop $0
  ${NSD_CreateLabel} 0 0 100% 28u "Encontrarás Maquetador DTF en el menú Inicio. También puedes crear un acceso directo en el escritorio."
  Pop $0
  ${NSD_CreateCheckbox} 0 40u 100% 15u "Crear un acceso directo en el escritorio"
  Pop $DTFShortcutCheckbox
  ${NSD_SetState} $DTFShortcutCheckbox $DTFCreateShortcut
  nsDialogs::Show
FunctionEnd

Function DTFOptionsLeave
  ${NSD_GetState} $DTFShortcutCheckbox $DTFCreateShortcut
FunctionEnd

!macroend

!macro customInstall
  ${If} $DTFCreateShortcut == ${BST_UNCHECKED}
    Delete "$newDesktopLink"
  ${EndIf}
!macroend
!endif
