/** Static skill ontology — parent/alias edges for inference without LLM. */

export type SkillEdge = { child: string; parents: string[]; aliases?: string[] };

/** child skill → implied parent skills (lowercase keys) */
export const SKILL_EDGES: SkillEdge[] = [
  { child: "fastapi", parents: ["python", "rest api", "api"] },
  { child: "django", parents: ["python", "web development"] },
  { child: "flask", parents: ["python", "web development"] },
  { child: "pytorch", parents: ["python", "machine learning", "deep learning"] },
  { child: "tensorflow", parents: ["python", "machine learning", "deep learning"] },
  { child: "pandas", parents: ["python", "data analysis"] },
  { child: "numpy", parents: ["python", "data analysis"] },
  { child: "scikit-learn", parents: ["python", "machine learning"], aliases: ["sklearn"] },
  { child: "langchain", parents: ["python", "llm", "ai"] },
  { child: "react", parents: ["javascript", "frontend"], aliases: ["react.js", "reactjs"] },
  { child: "vue", parents: ["javascript", "frontend"], aliases: ["vue.js", "vuejs"] },
  { child: "angular", parents: ["typescript", "frontend"], aliases: ["angular.js", "angularjs"] },
  { child: "nextjs", parents: ["react", "javascript", "frontend"], aliases: ["next.js", "next"] },
  { child: "nodejs", parents: ["javascript", "backend"], aliases: ["node.js", "node"] },
  { child: "express", parents: ["nodejs", "javascript", "rest api"], aliases: ["express.js", "expressjs"] },
  { child: "spring", parents: ["java", "backend"] },
  { child: "spring boot", parents: ["java", "spring", "backend"], aliases: ["springboot"] },
  { child: "kubernetes", parents: ["docker", "devops", "cloud"], aliases: ["k8s"] },
  { child: "terraform", parents: ["devops", "infrastructure"], aliases: ["terraform cloud"] },
  { child: "aws", parents: ["cloud"], aliases: ["amazon web services"] },
  { child: "gcp", parents: ["cloud"], aliases: ["google cloud", "google cloud platform"] },
  { child: "azure", parents: ["cloud"], aliases: ["microsoft azure"] },
  { child: "postgresql", parents: ["sql", "database"], aliases: ["postgres", "psql"] },
  { child: "mysql", parents: ["sql", "database"] },
  { child: "mongodb", parents: ["nosql", "database"], aliases: ["mongo"] },
  { child: "redis", parents: ["database", "caching"] },
  // GraphQL is an alternative to REST, not a form of it — listing "rest api" as a
  // parent credited a GraphQL-only engineer with REST experience.
  { child: "graphql", parents: ["api"] },
  { child: "rest", parents: ["api", "rest api"], aliases: ["restful", "rest apis", "restful apis", "rest api"] },
  { child: "microservices", parents: ["backend", "distributed systems"] },
  { child: "ci/cd", parents: ["devops"], aliases: ["cicd", "ci cd", "continuous integration", "continuous delivery"] },
  { child: "jenkins", parents: ["ci/cd", "devops"] },
  { child: "github actions", parents: ["ci/cd", "devops"], aliases: ["gh actions"] },
  { child: "docker", parents: ["devops", "containers"], aliases: ["dockerfile"] },
  { child: "kafka", parents: ["messaging", "distributed systems"], aliases: ["apache kafka"] },
  { child: "spark", parents: ["big data", "data engineering"], aliases: ["apache spark", "pyspark"] },
  { child: "airflow", parents: ["data engineering", "python"], aliases: ["apache airflow"] },
  { child: "tableau", parents: ["data visualization", "analytics"] },
  { child: "power bi", parents: ["data visualization", "analytics"], aliases: ["powerbi"] },
  { child: "selenium", parents: ["testing", "automation"] },
  { child: "jest", parents: ["testing", "javascript"] },
  { child: "cypress", parents: ["testing", "javascript"] },
  { child: "typescript", parents: ["javascript"], aliases: ["ts"] },
  { child: "tailwind", parents: ["css", "frontend"], aliases: ["tailwindcss", "tailwind css"] },

  /* ── Languages and fundamentals ──────────────────────────────────────────────
   * Mostly alias-only edges. Their job is to make one spelling win: a résumé that
   * says "JS" and a posting that says "JavaScript" have to meet somewhere, and the
   * alias table is the only place that can happen without every caller keeping its
   * own list. "java" deliberately has NO alias to "javascript" — they are different
   * languages, and conflating them is the classic way a match score lies.
   */
  { child: "javascript", parents: [], aliases: ["js", "ecmascript", "es6"] },
  { child: "go", parents: [], aliases: ["golang"] },
  { child: "html5", parents: ["frontend"], aliases: ["html"] },
  { child: "css3", parents: ["frontend"], aliases: ["css"] },
  { child: "sass", parents: ["css3", "frontend"], aliases: ["scss"] },
  { child: "bash", parents: ["linux"], aliases: ["shell", "shell scripting", "bash scripting"] },
  { child: "git", parents: [], aliases: ["version control"] },

  /* ── Frontend engineering ──────────────────────────────────────────────────── */
  { child: "redux", parents: ["state management", "javascript", "react"] },
  { child: "zustand", parents: ["state management", "react"] },
  { child: "mobx", parents: ["state management", "javascript"] },
  { child: "core web vitals", parents: ["web performance", "frontend"] },
  { child: "lighthouse", parents: ["web performance", "frontend"] },
  { child: "microfrontends", parents: ["frontend", "architecture"], aliases: ["micro frontends", "module federation", "single-spa"] },
  { child: "web workers", parents: ["frontend", "javascript"], aliases: ["service workers"] },
  { child: "playwright", parents: ["testing", "automation"] },
  { child: "vitest", parents: ["testing", "javascript"] },
  { child: "react native", parents: ["react", "mobile"], aliases: ["react-native"] },

  /* ── Backend and distributed systems ───────────────────────────────────────── */
  { child: "grpc", parents: ["api", "distributed systems"], aliases: ["protobuf", "protocol buffers"] },
  { child: "system design", parents: ["architecture"], aliases: ["systems design", "high level design", "hld"] },
  { child: "distributed transactions", parents: ["distributed systems"], aliases: ["saga pattern", "two-phase commit"] },
  { child: "cassandra", parents: ["nosql", "database", "distributed systems"], aliases: ["apache cassandra", "scylladb"] },
  { child: "elasticsearch", parents: ["database", "search"], aliases: ["opensearch", "elastic search"] },
  { child: "rabbitmq", parents: ["messaging"] },
  { child: "websockets", parents: ["api", "backend"], aliases: ["socket.io", "web sockets"] },

  /* ── Cloud native / platform ────────────────────────────────────────────────── */
  { child: "helm", parents: ["kubernetes", "devops"] },
  { child: "argocd", parents: ["gitops", "kubernetes", "ci/cd"], aliases: ["argo cd", "argo"] },
  { child: "gitops", parents: ["devops", "ci/cd"] },
  { child: "istio", parents: ["service mesh", "kubernetes"], aliases: ["service mesh (istio)"] },
  { child: "linkerd", parents: ["service mesh", "kubernetes"] },
  { child: "service mesh", parents: ["kubernetes", "devops"] },
  { child: "ansible", parents: ["devops", "infrastructure", "automation"] },
  { child: "prometheus", parents: ["observability", "devops", "monitoring"] },
  { child: "grafana", parents: ["observability", "monitoring", "data visualization"] },
  { child: "opentelemetry", parents: ["observability", "monitoring"], aliases: ["otel"] },
  { child: "cost optimization", parents: ["cloud", "devops"], aliases: ["finops", "cloud cost optimization"] },
  { child: "linux", parents: [], aliases: ["unix", "gnu/linux"] },

  /* ── AI / ML platform ───────────────────────────────────────────────────────── */
  { child: "llms", parents: ["ai", "machine learning"], aliases: ["llm", "large language models", "genai", "generative ai"] },
  { child: "mlops", parents: ["machine learning", "devops"], aliases: ["ml ops", "ml engineering"] },
  { child: "vector databases", parents: ["database", "llms"], aliases: ["vector database", "vector db", "pinecone", "milvus", "qdrant", "weaviate", "chromadb", "pgvector"] },
  { child: "llamaindex", parents: ["llms", "python"], aliases: ["llama index"] },
  { child: "vllm", parents: ["llms", "inference"], aliases: ["paged attention", "pagedattention"] },
  { child: "triton inference server", parents: ["inference", "mlops"], aliases: ["triton"] },
  { child: "kubeflow", parents: ["mlops", "kubernetes"] },
  { child: "cuda", parents: ["gpu", "deep learning"] },
  { child: "rag", parents: ["llms", "vector databases"], aliases: ["retrieval augmented generation", "retrieval-augmented generation"] },
  { child: "prompt engineering", parents: ["llms"] },
  { child: "hugging face", parents: ["machine learning", "python"], aliases: ["huggingface"] },
];
