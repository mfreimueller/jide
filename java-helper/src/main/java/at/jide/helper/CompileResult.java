package at.jide.helper;

import java.util.List;

public record CompileResult(boolean success, List<Diag> diagnostics) {}
