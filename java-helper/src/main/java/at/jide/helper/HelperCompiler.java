package at.jide.helper;

import java.io.IOException;
import java.io.OutputStream;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import javax.tools.Diagnostic;
import javax.tools.DiagnosticCollector;
import javax.tools.FileObject;
import javax.tools.ForwardingJavaFileManager;
import javax.tools.JavaCompiler;
import javax.tools.JavaFileManager;
import javax.tools.JavaFileObject;
import javax.tools.SimpleJavaFileObject;
import javax.tools.StandardJavaFileManager;

/** In-memory javac wrapper implementing the compile rules of SPEC 3.1/3.3 (incl. hidden harness). */
public final class HelperCompiler {

    static final String STUB = "\nvoid main() {}\n";
    static final String HARNESS_PREFIX = "Fehler im vorgegebenen Code: ";
    private static final List<String> OPTIONS =
            List.of("--release", "25", "-proc:none", "-encoding", "UTF-8");

    private final JavaCompiler compiler;

    public HelperCompiler(JavaCompiler compiler) {
        this.compiler = compiler;
    }

    public CompileResult compile(List<SourceFile> files, Harness harness, Path outDir) throws IOException {
        if (compiler == null) {
            throw new IllegalStateException(NO_COMPILER);
        }
        if (harness == null) {
            Run r = run(files, outDir);
            return new CompileResult(r.success, r.diags);
        }

        SourceFile target = null;
        for (SourceFile f : files) {
            if (f.path().equals(harness.appendTo())) target = f;
        }
        if (target == null) {
            throw new IllegalArgumentException(
                    "Die Datei '" + harness.appendTo() + "' für den vorgegebenen Code wurde nicht gefunden.");
        }
        String student = target.content();
        int n = Math.max(1, countLines(student));
        String appendTo = harness.appendTo();

        Run first = run(replace(files, target, student + "\n" + harness.content()), outDir);
        List<Diag> studentDiags = new ArrayList<>();
        List<Diag> harnessDiags = new ArrayList<>();
        for (Diag d : first.diags) {
            if (appendTo.equals(d.file()) && d.line() != null && d.line() > n) harnessDiags.add(d);
            else studentDiags.add(d);
        }
        if (harnessDiags.isEmpty()) {
            return new CompileResult(first.success, clampAll(studentDiags, appendTo, student, n));
        }

        // Is the problem in the student's file after all (e.g. an unclosed brace swallowing the harness)?
        Run stub = run(replace(files, target, student + STUB), null);
        boolean stubHasErrors = stub.diags.stream()
                .anyMatch(d -> "error".equals(d.severity()) && appendTo.equals(d.file()));
        Set<Diag> out = new LinkedHashSet<>();
        if (stubHasErrors) {
            out.addAll(studentDiags);
            for (Diag d : stub.diags) {
                if (!appendTo.equals(d.file())) continue;
                if (d.line() != null && d.line() > n) out.add(atLine(d, student, n, d.message(), "student"));
                else out.add(d);
            }
        } else {
            out.addAll(studentDiags);
            for (Diag d : harnessDiags) {
                out.add(atLine(d, student, n, HARNESS_PREFIX + d.message(), "harness"));
            }
        }
        return new CompileResult(false, clampAll(new ArrayList<>(out), appendTo, student, n));
    }

    static final String NO_COMPILER =
            "Kein Java-Compiler verfügbar: Der Helfer läuft nicht auf einem JDK (Modul jdk.compiler fehlt).";

    // ---- helpers -------------------------------------------------------------------------

    /** Rule 4: never report a line greater than n for the appendTo file. */
    private static List<Diag> clampAll(List<Diag> in, String appendTo, String student, int n) {
        List<Diag> out = new ArrayList<>();
        for (Diag d : in) {
            if (appendTo.equals(d.file()) && d.line() != null && d.line() > n) {
                out.add(atLine(d, student, n, d.message(), d.origin()));
            } else if (appendTo.equals(d.file()) && d.endLine() != null && d.endLine() > n) {
                int[] end = endOfLine(student, n);
                out.add(d.moved(d.line(), d.column(), end[0], end[1], d.message(), d.origin()));
            } else {
                out.add(d);
            }
        }
        return out;
    }

    /** Re-position a diagnostic onto the whole student line n (column 1 up to end of line). */
    private static Diag atLine(Diag d, String student, int n, String message, String origin) {
        int[] end = endOfLine(student, n);
        return d.moved(n, 1, end[0], end[1], message, origin);
    }

    private static int[] endOfLine(String text, int line) {
        int[] starts = lineStarts(text);
        int start = starts[Math.min(line, starts.length) - 1];
        int end = start;
        while (end < text.length() && text.charAt(end) != '\n' && text.charAt(end) != '\r') end++;
        return new int[] {line, Math.max(2, end - start + 1)};
    }

    private static List<SourceFile> replace(List<SourceFile> files, SourceFile target, String content) {
        List<SourceFile> l = new ArrayList<>();
        for (SourceFile f : files) l.add(f == target ? new SourceFile(f.path(), content) : f);
        return l;
    }

    /** Number of lines; a trailing line terminator does not start a new line. */
    static int countLines(String s) {
        if (s.isEmpty()) return 0;
        int[] starts = lineStarts(s);
        int lines = starts.length;
        if (starts[lines - 1] == s.length()) lines--;
        return lines;
    }

    /** Offsets at which lines start; terminators are \n, \r and \r\n like in javac. */
    static int[] lineStarts(String s) {
        List<Integer> l = new ArrayList<>();
        l.add(0);
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c == '\r' && i + 1 < s.length() && s.charAt(i + 1) == '\n') i++;
            if (c == '\n' || c == '\r') l.add(i + 1);
        }
        return l.stream().mapToInt(Integer::intValue).toArray();
    }

    private static int[] lineCol(int[] starts, long offset) {
        int lo = 0, hi = starts.length - 1;
        while (lo < hi) {
            int mid = (lo + hi + 1) >>> 1;
            if (starts[mid] <= offset) lo = mid; else hi = mid - 1;
        }
        return new int[] {lo + 1, (int) (offset - starts[lo]) + 1};
    }

    // ---- javac run -----------------------------------------------------------------------

    private record Run(boolean success, List<Diag> diags) {}

    private static final class MemSource extends SimpleJavaFileObject {
        final String path;
        final String content;
        final int[] starts;

        MemSource(String path, String content) {
            super(URI.create("string:///" + encode(path)), Kind.SOURCE);
            this.path = path;
            this.content = content;
            this.starts = lineStarts(content);
        }

        private static String encode(String p) {
            return p.replace('\\', '/').replace("%", "%25").replace(" ", "%20");
        }

        @Override public CharSequence getCharContent(boolean ignoreEncodingErrors) { return content; }
    }

    private static final class MemOutput extends SimpleJavaFileObject {
        private final Path target; // null = discard

        MemOutput(String className, Path target) {
            super(URI.create("mem:///" + className.replace('.', '/') + ".class"), Kind.CLASS);
            this.target = target;
        }

        @Override public OutputStream openOutputStream() throws IOException {
            if (target == null) return OutputStream.nullOutputStream();
            Files.createDirectories(target.getParent());
            return Files.newOutputStream(target);
        }
    }

    private Run run(List<SourceFile> files, Path outDir) throws IOException {
        Map<URI, MemSource> byUri = new HashMap<>();
        List<MemSource> sources = new ArrayList<>();
        for (SourceFile f : files) {
            MemSource s = new MemSource(f.path(), f.content());
            sources.add(s);
            byUri.put(s.toUri(), s);
        }
        if (outDir != null) Files.createDirectories(outDir);

        DiagnosticCollector<JavaFileObject> collector = new DiagnosticCollector<>();
        try (StandardJavaFileManager std =
                     compiler.getStandardFileManager(collector, Locale.GERMAN, StandardCharsets.UTF_8)) {
            JavaFileManager fm = new ForwardingJavaFileManager<>(std) {
                @Override
                public JavaFileObject getJavaFileForOutput(Location location, String className,
                                                          JavaFileObject.Kind kind, FileObject sibling) {
                    Path p = outDir == null ? null : outDir.resolve(className.replace('.', '/') + ".class");
                    return new MemOutput(className, p);
                }
            };
            boolean ok = compiler.getTask(null, fm, collector, OPTIONS, null, sources).call();

            List<Diag> diags = new ArrayList<>();
            for (Diagnostic<? extends JavaFileObject> d : collector.getDiagnostics()) {
                Diag mapped = map(d, byUri);
                if (mapped != null) diags.add(mapped);
            }
            return new Run(ok, diags);
        }
    }

    private static Diag map(Diagnostic<? extends JavaFileObject> d, Map<URI, MemSource> byUri) {
        String severity;
        switch (d.getKind()) {
            case ERROR -> severity = "error";
            case WARNING, MANDATORY_WARNING -> severity = "warning";
            default -> { return null; }
        }
        String message = d.getMessage(Locale.GERMAN);
        MemSource src = d.getSource() == null ? null : byUri.get(d.getSource().toUri());
        if (src == null) {
            // No source file: only errors are reported, as a general error.
            return "error".equals(severity)
                    ? new Diag(null, null, null, null, null, severity, message, "student") : null;
        }
        long start = d.getStartPosition();
        if (start == Diagnostic.NOPOS) start = d.getPosition();
        if (start == Diagnostic.NOPOS) {
            return new Diag(src.path, null, null, null, null, severity, message, "student");
        }
        long end = d.getEndPosition();
        int[] s = lineCol(src.starts, start);
        int[] e = (end == Diagnostic.NOPOS || end <= start)
                ? new int[] {s[0], s[1] + 1} : lineCol(src.starts, end);
        return new Diag(src.path, s[0], s[1], e[0], e[1], severity, message, "student");
    }
}
