// A ficha "locked" requer a chave para EDITAR, não é ficha exclusiva do mestre.
// A privacidade das rolagens segue masterOnly, redacted e private.
export function permittedSheet(sheet){
 return !!sheet && sheet.masterOnly!==true && sheet.masterOnly!=='true' &&
  sheet.redacted!==true && sheet.private!==true;
}
export function publicRoll(row, sheet){
 if(!row || row.hidden===true || row.hidden==='true')return false;
 return row.sheet_id==null || permittedSheet(sheet);
}
