export const MEDICATION_WINDOWS = {
  30: [
    // Insulinas
    'insulina','insulin','lantus','humalog','novolog','levemir','tresiba','basaglar','toujeo',
    // Anticoagulantes
    'warfarina','warfarin','coumadin','heparina','heparin','enoxaparina','enoxaparin','lovenox',
    'rivaroxaban','xarelto','apixaban','eliquis','dabigatran','pradaxa','edoxaban','fondaparinux',
    // Antiepilépticos
    'carbamazepina','carbamazepine','tegretol','fenitoina','phenytoin','dilantin',
    'valproato','valproic','depakote','levetiracetam','keppra','lamotrigina','lamictal',
    'topiramato','topamax','gabapentin','neurontin','pregabalina','lyrica',
    // Inmunosupresores
    'tacrolimus','prograf','ciclosporina','cyclosporine','sandimmune','azatioprina','azathioprine',
    'micofenolato','mycophenolate','cellcept','sirolimus','rapamune',
    // Cardíacos críticos
    'digoxina','digoxin','lanoxin','litio','lithium','eskalith',
    // Opioides
    'morfina','morphine','oxicodona','oxycodone','tramadol','fentanilo','fentanyl','hidrocodona',
    'hydrocodone','codeina','codeine','metadona','methadone',
    // Antipsicóticos
    'clozapina','clozaril','clozapine','risperidona','risperdal','quetiapina','seroquel',
    'olanzapina','zyprexa','aripiprazol','abilify','haloperidol','haldol',
  ],
  60: [
    // Antihipertensivos
    'losartan','cozaar','lisinopril','zestril','enalapril','vasotec','amlodipino','amlodipine',
    'norvasc','metoprolol','lopressor','atenolol','tenormin','carvedilol','coreg',
    'valsartan','diovan','irbesartan','avapro','candesartan','atacand',
    'hidralazina','hydralazine','nifedipino','nifedipine','diltiazem','cardizem','verapamil',
    // Antidepresivos
    'sertralina','sertraline','zoloft','escitalopram','lexapro','fluoxetina','fluoxetine',
    'prozac','paroxetina','paroxetine','paxil','venlafaxina','venlafaxine','effexor',
    'duloxetina','duloxetine','cymbalta','bupropion','wellbutrin','mirtazapina','mirtazapine',
    // Tiroides
    'levotiroxina','levothyroxine','synthroid','levoxyl','armour thyroid',
    // Diuréticos
    'furosemida','furosemide','lasix','hidroclorotiazida','hydrochlorothiazide','hctz',
    'espironolactona','spironolactone','aldactone','torsemida','torsemide',
    // Diabetes oral
    'metformina','metformin','glucophage','glipizida','glipizide','glucotrol',
    'glibenclamida','glyburide','diabeta','sitagliptina','sitagliptin','januvia',
    'empagliflozin','jardiance','dapagliflozin','farxiga',
    // Estatinas
    'atorvastatina','atorvastatin','lipitor','rosuvastatina','rosuvastatin','crestor',
    'simvastatina','simvastatin','zocor','pravastatina','pravastatin','pravachol',
  ],
  120: [
    'omeprazol','omeprazole','prilosec','pantoprazol','pantoprazole','protonix',
    'esomeprazol','esomeprazole','nexium','lansoprazol','lansoprazole','prevacid',
    'calcio','calcium','magnesio','magnesium','zinc','vitamina','vitamin',
    'hierro','iron','ferrous','acido folico','folic acid','b12','cobalamina',
    'cetirizina','cetirizine','zyrtec','loratadina','loratadine','claritin',
    'ranitidina','ranitidine','famotidina','famotidine','pepcid',
    'aspirina','aspirin','ibuprofeno','ibuprofen','naproxeno','naproxen',
  ],
}

export function detectMedicationWindow(medicationName) {
  if (!medicationName) return 60
  const name = medicationName.toLowerCase().trim()
  for (const [minutes, drugs] of Object.entries(MEDICATION_WINDOWS)) {
    if (drugs.some(drug => name.includes(drug))) return parseInt(minutes)
  }
  return 60
}

export function getMiloSuggestion(medicationName, detectedWindow) {
  if (detectedWindow === 30) {
    return `"${medicationName}" requiere precisión de tiempo. Te recomiendo una ventana de 30 minutos para asegurar el efecto correcto. ¿Quieres usar esa ventana?`
  }
  return null
}

export const WINDOW_OPTIONS = [
  { minutes: 30,  label: '30 min',  desc: 'Crítico' },
  { minutes: 60,  label: '1 hora',  desc: 'Estándar' },
  { minutes: 120, label: '2 horas', desc: 'Flexible' },
]
