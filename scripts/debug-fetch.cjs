const { createClient } = require("@supabase/supabase-js");
require("fs").readFileSync("/Users/dingkai/cursorcode/QuestionBank/.env", "utf-8").split("\n").forEach(line => {
  const [k, ...v] = line.split("=");
  if (k && v.length) process.env[k.trim()] = v.join("=").trim();
});
const supabase = createClient("https://orfxntmcywouoqpasivm.supabase.co", process.env.SUPABASE_ANON_KEY);

async function test() {
  const { data: labeledIds } = await supabase
    .from("subquestion_metadata")
    .select("subquestion_id")
    .not("question_type", "is", null)
    .limit(2000);

  console.log("Labeled count:", labeledIds?.length || 0);

  const { data: allIds } = await supabase
    .from("subquestions")
    .select("id")
    .order("id");

  console.log("Total subquestions:", allIds?.length || 0);

  const labeledSet = new Set(labeledIds.map(r => r.subquestion_id));
  const unlabeled = allIds.filter(r => !labeledSet.has(r.id));
  console.log("Unlabeled count:", unlabeled.length);
  if (unlabeled.length > 0) {
    console.log("First 3 unlabeled IDs:", unlabeled.slice(0, 3).map(r => r.id));
  }
}
test();
