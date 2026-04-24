const NOTEBOOK_CLIENT_ID_KEY = "newtube_notebook_client_id";

export const getNotebookClientId = () => {
  const existing = localStorage.getItem(NOTEBOOK_CLIENT_ID_KEY);
  if (existing) return existing;

  const generated =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `nb_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  localStorage.setItem(NOTEBOOK_CLIENT_ID_KEY, generated);
  return generated;
};
