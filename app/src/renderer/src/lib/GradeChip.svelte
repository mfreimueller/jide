<!-- Grade chip: "Beurteilt" + the symbol in bold (Figma: Schüler-App 28 / 29). -->
<script lang="ts">
  import { GRADE_TEXT, gradeTone, type GradeSymbol } from "../../../shared-types/grade";

  let { symbol }: { symbol: GradeSymbol } = $props();
  const tone = $derived(gradeTone(symbol));
</script>

<span class="chip grade" class:done={tone === "good"} class:wip={tone === "mid"} class:bad={tone === "bad"} data-testid="grade-chip" data-symbol={symbol}>
  Beurteilt <b data-testid="grade-symbol">{GRADE_TEXT[symbol]}</b>
</span>

<style>
  .grade b {
    font-size: 13px;
    font-weight: 700;
    margin-left: 2px;
  }
</style>
