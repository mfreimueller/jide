package at.jide.helper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import javax.tools.ToolProvider;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class HelperCompilerTest {

    private final HelperCompiler compiler = new HelperCompiler(ToolProvider.getSystemJavaCompiler());

    private static final String MAX_STUDENT = "int maximum(int a, int b) {\n    return a;\n}\n";
    private static final String MAX_HARNESS = "void main() {\n    IO.println(maximum(3, 7));\n}\n";

    private static String example(String rel) throws IOException {
        return Files.readString(Path.of("..", "examples", rel), StandardCharsets.UTF_8);
    }

    private CompileResult compile(String content, String harness) throws IOException {
        return compiler.compile(List.of(new SourceFile("A.java", content)),
                harness == null ? null : new Harness("A.java", harness), null);
    }

    @Test
    void syntaxErrorHasLineColumnAndGermanMessage() throws IOException {
        CompileResult r = compile("void main() {\n    int x = 5\n}\n", null);
        assertFalse(r.success());
        assertEquals(1, r.diagnostics().size());
        Diag d = r.diagnostics().get(0);
        assertEquals("A.java", d.file());
        assertEquals(2, d.line());
        assertEquals(14, d.column());
        assertEquals(2, d.endLine());
        assertEquals(15, d.endColumn());
        assertEquals("error", d.severity());
        assertEquals("';' erwartet", d.message());
        assertEquals("student", d.origin());
    }

    @Test
    void cleanCompile() throws IOException {
        CompileResult r = compile("void main() {\n    IO.println(\"Hallo\");\n}\n", null);
        assertTrue(r.success());
        assertTrue(r.diagnostics().isEmpty());
    }

    @Test
    void columnsAreCharacterBasedEvenWithTabs() throws IOException {
        CompileResult r = compile("void main() {\n\tint y = z;\n}\n", null);
        Diag d = r.diagnostics().get(0);
        assertEquals(2, d.line());
        assertEquals(10, d.column()); // tab counts as one column
        assertEquals(11, d.endColumn());
    }

    @Test
    void multipleFilesCompactMainUsesNormalClass() throws IOException {
        List<SourceFile> files = List.of(
                new SourceFile("Main.java", "void main() {\n    var p = new Person(\"Anna\");\n    IO.println(p.getName());\n}\n"),
                new SourceFile("Person.java", "class Person {\n    private final String name;\n    Person(String name) { this.name = name; }\n    String getName() { return name; }\n}\n"));
        CompileResult r = compiler.compile(files, null, null);
        assertTrue(r.success(), r.diagnostics().toString());

        List<SourceFile> broken = List.of(files.get(0),
                new SourceFile("Person.java", "class Person {\n    String getName() { return name }\n}\n"));
        CompileResult r2 = compiler.compile(broken, null, null);
        assertFalse(r2.success());
        assertTrue(r2.diagnostics().stream().allMatch(d -> "Person.java".equals(d.file())));
        assertEquals(2, r2.diagnostics().get(0).line());
    }

    @Test
    void harnessFromExampleCompiles() throws IOException {
        CompileResult r = compile(example("maximum/files/Maximum.java"), example("maximum/harness/Maximum.main.java"));
        assertTrue(r.success(), r.diagnostics().toString());
        assertTrue(r.diagnostics().isEmpty());
    }

    @Test
    void studentErrorWithHarnessStaysOnItsLine() throws IOException {
        CompileResult r = compile("int maximum(int a, int b) {\n    return a\n}\n", MAX_HARNESS);
        assertFalse(r.success());
        assertEquals(1, r.diagnostics().size());
        Diag d = r.diagnostics().get(0);
        assertEquals(2, d.line());
        assertEquals(13, d.column());
        assertEquals("';' erwartet", d.message());
        assertEquals("student", d.origin());
    }

    @Test
    void unclosedBraceWithHarnessIsReportedAtLastStudentLine() throws IOException {
        String student = "int maximum(int a, int b) {\n    return a;\n";
        CompileResult r = compile(student, MAX_HARNESS);
        assertFalse(r.success());
        assertFalse(r.diagnostics().isEmpty());
        for (Diag d : r.diagnostics()) {
            assertEquals("student", d.origin());
            assertEquals("A.java", d.file());
            assertEquals(2, d.line());
            assertEquals(1, d.column());
            assertTrue(d.endLine() <= 2);
            assertFalse(d.message().startsWith(HelperCompiler.HARNESS_PREFIX));
        }
        assertTrue(r.diagnostics().stream().anyMatch(d -> d.message().contains("Dateiende")),
                r.diagnostics().toString());
    }

    @Test
    void duplicateMainIsAStudentError() throws IOException {
        String student = "void main() {}\n" + MAX_STUDENT;
        CompileResult r = compile(student, MAX_HARNESS);
        assertFalse(r.success());
        assertEquals(1, r.diagnostics().size());
        Diag d = r.diagnostics().get(0);
        assertEquals("student", d.origin());
        assertEquals(4, d.line());
        assertTrue(d.message().contains("main()"));
    }

    @Test
    void brokenHarnessWithCorrectStudentFile() throws IOException {
        CompileResult r = compile(MAX_STUDENT, "void main() {\n    IO.println(foo(3));\n}\n");
        assertFalse(r.success());
        assertEquals(1, r.diagnostics().size());
        Diag d = r.diagnostics().get(0);
        assertEquals("harness", d.origin());
        assertEquals("A.java", d.file());
        assertEquals(3, d.line());
        assertEquals(1, d.column());
        assertTrue(d.message().startsWith("Fehler im vorgegebenen Code: "), d.message());
    }

    @Test
    void neverReportsLinesBeyondStudentContent() throws IOException {
        for (String harness : List.of("void main() {\n  int x = \n}\n", "void main() {\n  foo();\n}\n", "}}}")) {
            for (String student : List.of(MAX_STUDENT, MAX_STUDENT.stripTrailing(), "int f() {\n")) {
                int n = HelperCompiler.countLines(student);
                for (Diag d : compile(student, harness).diagnostics()) {
                    assertTrue(d.line() <= n, d.toString());
                    assertTrue(d.endLine() <= n, d.toString());
                }
            }
        }
    }

    @Test
    void outDirReceivesClassFiles(@TempDir Path tmp) throws IOException {
        Path out = tmp.resolve("sub/out");
        CompileResult r = compiler.compile(
                List.of(new SourceFile("Maximum.java", MAX_STUDENT)),
                new Harness("Maximum.java", MAX_HARNESS), out);
        assertTrue(r.success(), r.diagnostics().toString());
        assertTrue(Files.isRegularFile(out.resolve("Maximum.class")));
    }

    @Test
    void protocolReportsGermanErrorWithoutCompiler() {
        Protocol p = new Protocol(null);
        String r = p.handle("{\"id\":7,\"op\":\"compile\",\"files\":[]}");
        assertTrue(r.contains("\"id\":7") && r.contains("\"ok\":false") && r.contains("Kein Java-Compiler"), r);
        assertTrue(p.handle("{\"id\":8,\"op\":\"ping\"}").contains("Kein Java-Compiler"));
    }

    @Test
    void protocolHandlesBadInput() {
        Protocol p = new Protocol(ToolProvider.getSystemJavaCompiler());
        String bad = p.handle("{not json");
        assertTrue(bad.contains("\"id\":null") && bad.contains("\"ok\":false"), bad);
        String unknown = p.handle("{\"id\":5,\"op\":\"foo\"}");
        assertTrue(unknown.contains("\"id\":5") && unknown.contains("Unbekannte Operation"), unknown);
        assertNotNull(p.handle("{\"id\":6,\"op\":\"compile\"}"));
    }
}
