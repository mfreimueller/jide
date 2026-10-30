/** Java keywords and code snippets for completion (German descriptions). */

export interface Keyword {
  word: string;
  doc: string;
}

export interface Snippet {
  /** What the student types, e.g. "for". */
  label: string;
  /** Short title shown next to the label. */
  detail: string;
  doc: string;
  /** Monaco snippet text ($1, ${2:name}, $0). Tabs are converted to the editor's indentation. */
  insert: string;
}

// Keywords used in the slides' code blocks (ch. 01-23), plus the primitive types of ch. 02
// (byte, short, long, float) and `finally` / `extends` / `enum`.
export const KEYWORDS: readonly Keyword[] = [
  { word: "if", doc: "Führt Code nur aus, wenn eine Bedingung wahr ist." },
  { word: "else", doc: "Alternative zu if: wird ausgeführt, wenn die Bedingung falsch ist." },
  { word: "switch", doc: "Wählt anhand eines Wertes einen von mehreren Fällen (case) aus." },
  { word: "case", doc: "Ein Fall innerhalb von switch." },
  { word: "default", doc: "Der Fall in switch, wenn kein case passt." },
  { word: "for", doc: "Zählschleife oder Schleife über ein Array." },
  { word: "while", doc: "Wiederholt Code, solange die Bedingung wahr ist." },
  { word: "do", doc: "do-while: Schleife, die mindestens einmal ausgeführt wird." },
  { word: "break", doc: "Beendet die Schleife oder den switch-Fall sofort." },
  { word: "continue", doc: "Springt zum nächsten Schleifendurchlauf." },
  { word: "return", doc: "Beendet die Methode und gibt (optional) einen Wert zurück." },
  { word: "void", doc: "Rückgabetyp: die Methode gibt nichts zurück." },
  { word: "int", doc: "Datentyp für ganze Zahlen." },
  { word: "double", doc: "Datentyp für Kommazahlen." },
  { word: "float", doc: "Datentyp für Kommazahlen (weniger genau als double)." },
  { word: "long", doc: "Datentyp für sehr große ganze Zahlen." },
  { word: "short", doc: "Datentyp für kleine ganze Zahlen." },
  { word: "byte", doc: "Datentyp für ganz kleine ganze Zahlen (-128 bis 127)." },
  { word: "boolean", doc: "Datentyp für Wahrheitswerte (true oder false)." },
  { word: "char", doc: "Datentyp für ein einzelnes Zeichen, z. B. 'a'." },
  { word: "true", doc: "Wahrheitswert wahr." },
  { word: "false", doc: "Wahrheitswert falsch." },
  { word: "null", doc: "Kein Objekt: die Variable zeigt auf nichts." },
  { word: "new", doc: "Erzeugt ein neues Objekt oder Array." },
  { word: "class", doc: "Definiert eine Klasse." },
  { word: "this", doc: "Das aktuelle Objekt (z. B. this.name = name;)." },
  { word: "public", doc: "Sichtbar für alle anderen Klassen." },
  { word: "private", doc: "Nur innerhalb der eigenen Klasse sichtbar." },
  { word: "static", doc: "Gehört zur Klasse und nicht zu einem einzelnen Objekt." },
  { word: "final", doc: "Konstante: der Wert kann nicht mehr geändert werden." },
  { word: "enum", doc: "Definiert eine Aufzählung fester Werte." },
  { word: "extends", doc: "Die Klasse erbt von einer anderen Klasse." },
  { word: "import", doc: "Macht eine Klasse aus einem Paket verfügbar, z. B. import java.util.Scanner;" },
  { word: "try", doc: "Beginnt einen Block, in dem ein Fehler auftreten kann." },
  { word: "catch", doc: "Behandelt einen Fehler aus dem try-Block." },
  { word: "finally", doc: "Wird nach try/catch immer ausgeführt." }
];

export const SNIPPETS: readonly Snippet[] = [
  {
    label: "if",
    detail: "if-Verzweigung",
    doc: "Führt den Block nur aus, wenn die Bedingung wahr ist.",
    insert: "if (${1:bedingung}) {\n\t$0\n}"
  },
  {
    label: "if",
    detail: "if / else",
    doc: "Zwei Wege: einer für wahr, einer für falsch.",
    insert: "if (${1:bedingung}) {\n\t$2\n} else {\n\t$0\n}"
  },
  {
    label: "else if",
    detail: "weitere Bedingung",
    doc: "Weitere Bedingung nach einem if.",
    insert: "else if (${1:bedingung}) {\n\t$0\n}"
  },
  {
    label: "for",
    detail: "Zählschleife",
    doc: "Wiederholt den Block für i = 0, 1, 2, … bis zur Grenze.",
    insert: "for (int ${1:i} = 0; ${1:i} < ${2:grenze}; ${1:i}++) {\n\t$0\n}"
  },
  {
    label: "for",
    detail: "Schleife über Array",
    doc: "Durchläuft alle Elemente eines Arrays (for-each).",
    insert: "for (${1:int} ${2:element} : ${3:array}) {\n\t$0\n}"
  },
  {
    label: "while",
    detail: "while-Schleife",
    doc: "Wiederholt den Block, solange die Bedingung wahr ist.",
    insert: "while (${1:bedingung}) {\n\t$0\n}"
  },
  {
    label: "do",
    detail: "do-while-Schleife",
    doc: "Führt den Block mindestens einmal aus und wiederholt ihn, solange die Bedingung wahr ist.",
    insert: "do {\n\t$0\n} while (${1:bedingung});"
  },
  {
    label: "switch",
    detail: "switch mit case",
    doc: "Wählt anhand eines Wertes einen Fall aus. Jeder Fall endet mit break.",
    insert:
      "switch (${1:ausdruck}) {\n\tcase ${2:wert1}:\n\t\t$3\n\t\tbreak;\n\tcase ${4:wert2}:\n\t\t$5\n\t\tbreak;\n\tdefault:\n\t\t$0\n\t\tbreak;\n}"
  },
  {
    label: "void main()",
    detail: "Hauptprogramm",
    doc: "Der Startpunkt deines Programms.",
    insert: "void main() {\n\t$0\n}"
  },
  {
    label: "methode",
    detail: "Methode",
    doc: "Gerüst für eine eigene Methode.",
    insert: "${1:int} ${2:name}(${3:int a, int b}) {\n\t$0\n\treturn ${4:wert};\n}"
  },
  {
    label: "class",
    detail: "Klasse mit Konstruktor",
    doc: "Gerüst für eine Klasse mit Attribut und Konstruktor.",
    insert:
      "class ${1:Name} {\n\tprivate ${2:String} ${3:name};\n\n\tpublic ${1:Name}(${2:String} ${3:name}) {\n\t\tthis.${3:name} = ${3:name};\n\t}\n\n\t$0\n}"
  },
  {
    label: "Scanner",
    detail: "Scanner sc = new Scanner(System.in);",
    doc: "Erstellt einen Scanner, mit dem du Eingaben von der Tastatur liest.",
    insert: "Scanner ${1:sc} = new Scanner(System.in);"
  },
  {
    label: "Random",
    detail: "Random r = new Random();",
    doc: "Erstellt einen Zufallszahlen-Generator.",
    insert: "Random ${1:r} = new Random();"
  },
  {
    label: "try",
    detail: "try / catch",
    doc: "Fängt einen Fehler ab, der im try-Block auftreten kann.",
    insert: "try {\n\t$0\n} catch (${1:Exception} ${2:e}) {\n\tSystem.out.println(\"Fehler: \" + ${2:e}.getMessage());\n}"
  },
  {
    label: "javadoc",
    detail: "JavaDoc-Kommentar",
    doc: "Dokumentiert eine Methode mit @param und @return.",
    insert: "/**\n * ${1:Beschreibung}\n *\n * @param ${2:name} ${3:Beschreibung}\n * @return ${0:Beschreibung}\n */"
  }
];
