/**
 * Curated catalogue for code completion (SPEC 3.1, Option A: no real code analysis).
 * Content follows the course slides POS 1xHIF (chapter numbers in the comments); entries marked
 * "Vorgabe" are explicitly required by the project owner although the slides do not use them yet.
 * All user-visible texts are German.
 */

export type MemberKind = "method" | "field" | "constant";

export interface Member {
  name: string;
  kind: MemberKind;
  /** Shown next to the label, e.g. "(int a, int b): int" or ": double". */
  detail: string;
  /** Parameter list as written, e.g. "int a, int b" (empty for fields and no-arg methods). */
  params: string;
  /** Return or field type, empty for constructors. */
  returns: string;
  /** Monaco snippet text with placeholders for parameters. */
  insert: string;
  /** Short German description. */
  doc: string;
  /** One-line example. */
  example: string;
}

export interface ClassInfo {
  name: string;
  /** Short German description of the class. */
  doc: string;
  example: string;
  /** Constructors, offered after `new `. */
  constructors: Member[];
  /** Static members: `Math.max`, `IO.println`, `System.out.println` (class name "System.out"). */
  statics: Member[];
  /** Instance members: `sc.nextInt()`. */
  instance: Member[];
}

type Param = readonly [type: string, name: string];

function method(name: string, params: Param[], returns: string, doc: string, example: string): Member {
  const list = params.map(([t, n]) => `${t} ${n}`.trim()).join(", ");
  const detail = `(${list})` + (returns ? `: ${returns}` : "");
  const insert = `${name}(${params.map(([, n], i) => `\${${i + 1}:${n}}`).join(", ")})`;
  return { name, kind: "method", detail, params: list, returns, insert, doc, example };
}

function field(name: string, type: string, doc: string, example: string, kind: MemberKind = "field"): Member {
  return { name, kind, detail: `: ${type}`, params: "", returns: type, insert: name, doc, example };
}

function ctor(className: string, params: Param[], doc: string, example: string): Member {
  const m = method(className, params, "", doc, example);
  return { ...m, name: className };
}

const none: Param[] = [];

const IO: ClassInfo = {
  // "Vorgabe": Java 25 (compact source files); the slides still use System.out (ch. 01-23).
  name: "IO",
  doc: "Einfache Ein- und Ausgabe in der Konsole (ab Java 25).",
  example: 'IO.println("Hallo");',
  constructors: [],
  statics: [
    method("println", [["Object", "wert"]], "void", "Gibt etwas aus und springt danach in eine neue Zeile.", 'IO.println("Hallo Welt");'),
    method("print", [["Object", "wert"]], "void", "Gibt etwas aus, ohne in eine neue Zeile zu springen.", 'IO.print("Name: ");'),
    method("readln", [["String", "frage"]], "String", "Zeigt die Frage an und liest eine Zeile Text von der Tastatur.", 'String name = IO.readln("Name: ");')
  ],
  instance: []
};

// ch. 01-23: System.out.println / print; printf is the console twin of PrintWriter.printf (ch. 23)
const SYSTEM: ClassInfo = {
  name: "System",
  doc: "Zugriff auf Konsole (Ausgabe und Eingabe).",
  example: "System.out.println(5);",
  constructors: [],
  statics: [
    field("out", "PrintStream", "Die Konsolenausgabe. Danach folgt println, print oder printf.", 'System.out.println("Hallo");'),
    field("in", "InputStream", "Die Tastatureingabe, wird dem Scanner übergeben.", "Scanner sc = new Scanner(System.in);")
  ],
  instance: []
};

const SYSTEM_OUT: ClassInfo = {
  name: "System.out",
  doc: "Die Konsolenausgabe.",
  example: 'System.out.println("Hallo");',
  constructors: [],
  statics: [
    method("println", [["Object", "wert"]], "void", "Gibt etwas aus und springt danach in eine neue Zeile.", 'System.out.println("Summe: " + summe);'),
    method("print", [["Object", "wert"]], "void", "Gibt etwas aus, ohne in eine neue Zeile zu springen.", 'System.out.print("Zahl: ");'),
    method("printf", [["String", "format"], ["Object...", "werte"]], "PrintStream", "Gibt formatierten Text aus (%d ganze Zahl, %s Text, %.2f Kommazahl, %n neue Zeile).", 'System.out.printf("Alter: %d%n", alter);')
  ],
  instance: []
};

// ch. 12 (String-Methoden), ch. 13 (replace), ch. 16 (split, toLowerCase), ch. 19 (isEmpty).
// substring, indexOf, contains, equalsIgnoreCase are additions beyond the slides.
const STRING: ClassInfo = {
  name: "String",
  doc: "Text (Zeichenkette).",
  example: 'String name = "Anna";',
  constructors: [],
  statics: [],
  instance: [
    method("length", none, "int", "Anzahl der Zeichen im Text. Achtung: mit Klammern!", "int n = text.length();"),
    method("charAt", [["int", "index"]], "char", "Das Zeichen an der Stelle index (das erste Zeichen hat Index 0).", "char erstes = text.charAt(0);"),
    method("equals", [["String", "anderer"]], "boolean", "Vergleicht zwei Texte auf Gleichheit. Niemals == für Texte verwenden!", 'if (eingabe.equals("exit")) { }'),
    method("startsWith", [["String", "anfang"]], "boolean", "Prüft, ob der Text mit anfang beginnt.", 'befehl.startsWith("gehe")'),
    method("endsWith", [["String", "ende"]], "boolean", "Prüft, ob der Text mit ende aufhört.", 'frage.endsWith("?")'),
    method("trim", none, "String", "Entfernt Leerzeichen am Anfang und am Ende.", "String sauber = text.trim();"),
    method("toUpperCase", none, "String", "Wandelt alle Buchstaben in Großbuchstaben um.", "String gross = text.toUpperCase();"),
    method("toLowerCase", none, "String", "Wandelt alle Buchstaben in Kleinbuchstaben um.", "String klein = text.toLowerCase();"),
    method("replace", [["char", "alt"], ["char", "neu"]], "String", "Ersetzt jedes Vorkommen von alt durch neu.", "eingabe = eingabe.replace(',', '.');"),
    method("isEmpty", none, "boolean", "Prüft, ob der Text leer ist (Länge 0).", "if (name.isEmpty()) { }"),
    method("split", [["String", "trenner"]], "String[]", "Zerlegt den Text an jedem trenner in ein Array von Teilen.", 'String[] teile = eingabe.split(" ");'),
    method("substring", [["int", "von"], ["int", "bis"]], "String", "Teil des Textes von Index von bis vor Index bis.", "String teil = text.substring(0, 3);"),
    method("indexOf", [["String", "suche"]], "int", "Stelle des ersten Vorkommens von suche oder -1, wenn nicht gefunden.", 'int pos = text.indexOf("a");'),
    method("contains", [["String", "teil"]], "boolean", "Prüft, ob der Text teil enthält.", 'if (text.contains("Java")) { }'),
    method("equalsIgnoreCase", [["String", "anderer"]], "boolean", "Wie equals, aber Groß- und Kleinschreibung wird ignoriert.", 'if (antwort.equalsIgnoreCase("ja")) { }')
  ]
};

// "Vorgabe" (not in the slides)
const MATH: ClassInfo = {
  name: "Math",
  doc: "Mathematische Funktionen.",
  example: "int groesser = Math.max(a, b);",
  constructors: [],
  statics: [
    method("max", [["int", "a"], ["int", "b"]], "int", "Die größere von zwei Zahlen.", "int groesser = Math.max(a, b);"),
    method("min", [["int", "a"], ["int", "b"]], "int", "Die kleinere von zwei Zahlen.", "int kleiner = Math.min(a, b);"),
    method("abs", [["int", "zahl"]], "int", "Der Betrag einer Zahl (ohne Vorzeichen).", "int betrag = Math.abs(-5); // 5"),
    method("sqrt", [["double", "zahl"]], "double", "Die Quadratwurzel einer Zahl.", "double w = Math.sqrt(16); // 4.0"),
    method("pow", [["double", "basis"], ["double", "exponent"]], "double", "Potenz: basis hoch exponent.", "double q = Math.pow(2, 3); // 8.0"),
    method("round", [["double", "zahl"]], "long", "Rundet auf die nächste ganze Zahl.", "long r = Math.round(2.5); // 3"),
    method("floor", [["double", "zahl"]], "double", "Rundet ab.", "double r = Math.floor(2.9); // 2.0"),
    method("ceil", [["double", "zahl"]], "double", "Rundet auf.", "double r = Math.ceil(2.1); // 3.0"),
    method("random", none, "double", "Zufallszahl von 0.0 (inklusive) bis 1.0 (exklusive).", "double z = Math.random();"),
    field("PI", "double", "Die Kreiszahl Pi (3.14159...).", "double umfang = 2 * Math.PI * r;", "constant")
  ],
  instance: []
};

// ch. 06 (User Input)
const SCANNER: ClassInfo = {
  name: "Scanner",
  doc: "Liest Eingaben von der Tastatur.",
  example: "Scanner sc = new Scanner(System.in);",
  constructors: [ctor("Scanner", [["", "System.in"]], "Erstellt einen Scanner, der von der Tastatur liest.", "Scanner sc = new Scanner(System.in);")],
  statics: [],
  instance: [
    method("nextInt", none, "int", "Liest eine ganze Zahl.", "int alter = sc.nextInt();"),
    method("nextDouble", none, "double", "Liest eine Kommazahl.", "double preis = sc.nextDouble();"),
    method("nextLine", none, "String", "Liest eine ganze Zeile Text.", "String name = sc.nextLine();"),
    method("next", none, "String", "Liest das nächste Wort (bis zum nächsten Leerzeichen).", "String wort = sc.next();"),
    method("nextBoolean", none, "boolean", "Liest true oder false.", "boolean ja = sc.nextBoolean();"),
    method("hasNextInt", none, "boolean", "Prüft, ob als Nächstes eine ganze Zahl kommt.", "if (sc.hasNextInt()) { }"),
    method("hasNextLine", none, "boolean", "Prüft, ob noch eine weitere Zeile vorhanden ist.", "while (sc.hasNextLine()) { }"),
    method("hasNext", none, "boolean", "Prüft, ob noch ein weiteres Wort vorhanden ist.", "while (sc.hasNext()) { }"),
    method("close", none, "void", "Schließt den Scanner, wenn du ihn nicht mehr brauchst.", "sc.close();")
  ]
};

// ch. 06 (Zufallszahlen)
const RANDOM: ClassInfo = {
  name: "Random",
  doc: "Erzeugt Zufallszahlen.",
  example: "Random r = new Random();",
  constructors: [ctor("Random", none, "Erstellt einen Zufallszahlen-Generator.", "Random r = new Random();")],
  statics: [],
  instance: [
    method("nextInt", [["int", "grenze"]], "int", "Zufällige ganze Zahl von 0 bis grenze - 1.", "int wuerfel = r.nextInt(6) + 1; // 1 bis 6"),
    method("nextDouble", none, "double", "Zufällige Kommazahl von 0.0 bis 1.0.", "double z = r.nextDouble();"),
    method("nextBoolean", none, "boolean", "Zufällig true oder false.", "boolean kopf = r.nextBoolean();")
  ]
};

// ch. 06, 13 (Convert)
const INTEGER: ClassInfo = {
  name: "Integer",
  doc: "Ganze Zahlen und Umwandlung von Text in Zahlen.",
  example: 'int zahl = Integer.parseInt("42");',
  constructors: [],
  statics: [
    method("parseInt", [["String", "text"]], "int", "Wandelt einen Text in eine ganze Zahl um.", 'int alter = Integer.parseInt("42");'),
    method("valueOf", [["String", "text"]], "Integer", "Wandelt einen Text in eine ganze Zahl um (als Objekt).", 'Integer z = Integer.valueOf("7");'),
    method("toString", [["int", "zahl"]], "String", "Wandelt eine Zahl in Text um.", "String s = Integer.toString(42);"),
    field("MAX_VALUE", "int", "Die größte mögliche int-Zahl (2147483647).", "int max = Integer.MAX_VALUE;", "constant"),
    field("MIN_VALUE", "int", "Die kleinste mögliche int-Zahl (-2147483648).", "int min = Integer.MIN_VALUE;", "constant")
  ],
  instance: []
};

// ch. 13 (Convert)
const DOUBLE: ClassInfo = {
  name: "Double",
  doc: "Kommazahlen und Umwandlung von Text in Kommazahlen.",
  example: 'double d = Double.parseDouble("3.14");',
  constructors: [],
  statics: [
    method("parseDouble", [["String", "text"]], "double", "Wandelt einen Text (mit Punkt) in eine Kommazahl um.", 'double d = Double.parseDouble("3.14");'),
    method("valueOf", [["String", "text"]], "Double", "Wandelt einen Text in eine Kommazahl um (als Objekt).", 'Double d = Double.valueOf("2.5");'),
    method("toString", [["double", "zahl"]], "String", "Wandelt eine Kommazahl in Text um.", "String s = Double.toString(2.5);"),
    field("MAX_VALUE", "double", "Die größte mögliche double-Zahl.", "double max = Double.MAX_VALUE;", "constant"),
    field("MIN_VALUE", "double", "Die kleinste positive double-Zahl.", "double min = Double.MIN_VALUE;", "constant")
  ],
  instance: []
};

// ch. 13 (Convert)
const BOOLEAN: ClassInfo = {
  name: "Boolean",
  doc: "Wahrheitswerte und Umwandlung von Text.",
  example: 'boolean b = Boolean.parseBoolean("true");',
  constructors: [],
  statics: [method("parseBoolean", [["String", "text"]], "boolean", 'Wandelt den Text "true" oder "false" in einen boolean um.', 'boolean ok = Boolean.parseBoolean("true");')],
  instance: []
};

// "Vorgabe" (not in the slides)
const CHARACTER: ClassInfo = {
  name: "Character",
  doc: "Hilfsmethoden für einzelne Zeichen (char).",
  example: "boolean z = Character.isDigit('7');",
  constructors: [],
  statics: [
    method("isDigit", [["char", "zeichen"]], "boolean", "Prüft, ob das Zeichen eine Ziffer ist.", "Character.isDigit('7') // true"),
    method("isLetter", [["char", "zeichen"]], "boolean", "Prüft, ob das Zeichen ein Buchstabe ist.", "Character.isLetter('a') // true"),
    method("isLetterOrDigit", [["char", "zeichen"]], "boolean", "Prüft, ob das Zeichen ein Buchstabe oder eine Ziffer ist.", "Character.isLetterOrDigit('_') // false"),
    method("isUpperCase", [["char", "zeichen"]], "boolean", "Prüft, ob das Zeichen ein Großbuchstabe ist.", "Character.isUpperCase('A') // true"),
    method("isLowerCase", [["char", "zeichen"]], "boolean", "Prüft, ob das Zeichen ein Kleinbuchstabe ist.", "Character.isLowerCase('a') // true"),
    method("isWhitespace", [["char", "zeichen"]], "boolean", "Prüft, ob das Zeichen ein Leerzeichen, Tab oder Zeilenumbruch ist.", "Character.isWhitespace(' ') // true"),
    method("toUpperCase", [["char", "zeichen"]], "char", "Wandelt ein Zeichen in einen Großbuchstaben um.", "char g = Character.toUpperCase('a'); // 'A'"),
    method("toLowerCase", [["char", "zeichen"]], "char", "Wandelt ein Zeichen in einen Kleinbuchstaben um.", "char k = Character.toLowerCase('A'); // 'a'")
  ],
  instance: []
};

// "Vorgabe" (ch. 10/11 teach arrays and sorting, but only with own loops, not java.util.Arrays)
const ARRAYS: ClassInfo = {
  name: "Arrays",
  doc: "Hilfsmethoden für Arrays.",
  example: "Arrays.sort(zahlen);",
  constructors: [],
  statics: [
    method("toString", [["int[]", "array"]], "String", "Wandelt ein Array in Text um, z. B. [1, 2, 3].", "IO.println(Arrays.toString(zahlen));"),
    method("sort", [["int[]", "array"]], "void", "Sortiert ein Array aufsteigend.", "Arrays.sort(zahlen);"),
    method("fill", [["int[]", "array"], ["int", "wert"]], "void", "Setzt alle Elemente auf denselben Wert.", "Arrays.fill(zahlen, 0);"),
    method("copyOf", [["int[]", "array"], ["int", "laenge"]], "int[]", "Kopiert ein Array in ein neues Array der gegebenen Länge.", "int[] kopie = Arrays.copyOf(zahlen, zahlen.length);"),
    method("equals", [["int[]", "a"], ["int[]", "b"]], "boolean", "Prüft, ob zwei Arrays gleich lang sind und dieselben Werte haben.", "if (Arrays.equals(a, b)) { }")
  ],
  instance: []
};

/** Pseudo class for variables of an array type: `int[] zahlen; zahlen.` (ch. 10). */
const ARRAY: ClassInfo = {
  name: "[]",
  doc: "Array.",
  example: "int[] zahlen = new int[5];",
  constructors: [],
  statics: [],
  instance: [field("length", "int", "Anzahl der Elemente im Array. Ohne Klammern (keine Methode)!", "for (int i = 0; i < zahlen.length; i++) { }")]
};

// ch. 23 (Dateioperationen): FileReader + BufferedReader, FileWriter + PrintWriter, IOException.
// The slides do not use Files or Path, so they are not part of the catalogue.
const FILE_READER: ClassInfo = {
  name: "FileReader",
  doc: "Liest Zeichen aus einer Datei. Wird meist an einen BufferedReader übergeben.",
  example: 'FileReader fr = new FileReader("datei.txt");',
  constructors: [ctor("FileReader", [["String", "dateiname"]], "Öffnet eine Datei zum Lesen.", 'FileReader fr = new FileReader("datei.txt");')],
  statics: [],
  instance: [method("close", none, "void", "Schließt die Datei.", "fr.close();")]
};

const BUFFERED_READER: ClassInfo = {
  name: "BufferedReader",
  doc: "Liest eine Datei zeilenweise.",
  example: 'BufferedReader br = new BufferedReader(new FileReader("datei.txt"));',
  constructors: [ctor("BufferedReader", [["", "new FileReader(\"datei.txt\")"]], "Packt einen FileReader ein und macht das Lesen effizient.", 'BufferedReader br = new BufferedReader(new FileReader("datei.txt"));')],
  statics: [],
  instance: [
    method("readLine", none, "String", "Liest die nächste Zeile. Am Dateiende ist das Ergebnis null.", "String zeile = br.readLine();"),
    method("close", none, "void", "Schließt die Datei (Ressource freigeben!).", "br.close();")
  ]
};

const FILE_WRITER: ClassInfo = {
  name: "FileWriter",
  doc: "Schreibt Zeichen in eine Datei. Wird meist an einen PrintWriter übergeben.",
  example: 'FileWriter fw = new FileWriter("ausgabe.txt");',
  constructors: [
    ctor("FileWriter", [["String", "dateiname"]], "Öffnet eine Datei zum Schreiben (überschreibt den alten Inhalt).", 'FileWriter fw = new FileWriter("ausgabe.txt");'),
    ctor("FileWriter", [["String", "dateiname"], ["boolean", "anhaengen"]], "Öffnet eine Datei zum Schreiben; mit true wird angehängt statt überschrieben.", 'FileWriter fw = new FileWriter("datei.txt", true);')
  ],
  statics: [],
  instance: [method("close", none, "void", "Schließt die Datei.", "fw.close();")]
};

const PRINT_WRITER: ClassInfo = {
  name: "PrintWriter",
  doc: "Schreibt Text bequem in eine Datei (wie System.out in die Konsole).",
  example: 'PrintWriter pw = new PrintWriter(new FileWriter("ausgabe.txt"));',
  constructors: [ctor("PrintWriter", [["", "new FileWriter(\"ausgabe.txt\")"]], "Packt einen FileWriter ein.", 'PrintWriter pw = new PrintWriter(new FileWriter("ausgabe.txt"));')],
  statics: [],
  instance: [
    method("println", [["Object", "wert"]], "void", "Schreibt eine Zeile in die Datei.", 'pw.println("Zeile 1");'),
    method("print", [["Object", "wert"]], "void", "Schreibt Text ohne Zeilenumbruch in die Datei.", 'pw.print("Text");'),
    method("printf", [["String", "format"], ["Object...", "werte"]], "PrintWriter", "Schreibt formatierten Text in die Datei.", 'pw.printf("Zahl: %d%n", 42);'),
    method("close", none, "void", "Schließt die Datei. Erst dann ist sicher alles gespeichert.", "pw.close();")
  ]
};

const EXCEPTION_MEMBERS = [method("getMessage", none, "String", "Die Fehlermeldung der Ausnahme.", 'IO.println("Fehler: " + e.getMessage());')];

// ch. 23 (IOException behandeln); Exception in ch. 03, 10, 12, 13, 20
const IO_EXCEPTION: ClassInfo = {
  name: "IOException",
  doc: "Fehler bei Dateizugriffen (muss mit try-catch behandelt werden).",
  example: "catch (IOException e) { }",
  constructors: [],
  statics: [],
  instance: EXCEPTION_MEMBERS
};

const FILE_NOT_FOUND: ClassInfo = {
  name: "FileNotFoundException",
  doc: "Die Datei wurde nicht gefunden (Untertyp von IOException).",
  example: "catch (FileNotFoundException e) { }",
  constructors: [],
  statics: [],
  instance: EXCEPTION_MEMBERS
};

const EXCEPTION: ClassInfo = {
  name: "Exception",
  doc: "Allgemeine Ausnahme (Fehler zur Laufzeit).",
  example: "catch (Exception e) { }",
  constructors: [],
  statics: [],
  instance: EXCEPTION_MEMBERS
};

export const CLASSES: readonly ClassInfo[] = [
  IO, SYSTEM, STRING, MATH, SCANNER, RANDOM, INTEGER, DOUBLE, BOOLEAN, CHARACTER, ARRAYS,
  FILE_READER, BUFFERED_READER, FILE_WRITER, PRINT_WRITER, IO_EXCEPTION, FILE_NOT_FOUND, EXCEPTION
];

/** Receivers like `System.out` that are static "paths" but not classes of their own. */
export const STATIC_RECEIVERS: readonly ClassInfo[] = [...CLASSES, SYSTEM_OUT];

/** Class names offered as plain identifiers (everything with a name that is a real class). */
export const CLASS_NAMES: readonly ClassInfo[] = CLASSES;

export const ARRAY_TYPE: ClassInfo = ARRAY;

export function findClass(name: string): ClassInfo | undefined {
  return CLASSES.find((c) => c.name === name);
}

export function findStaticReceiver(path: string): ClassInfo | undefined {
  return STATIC_RECEIVERS.find((c) => c.name === path);
}
