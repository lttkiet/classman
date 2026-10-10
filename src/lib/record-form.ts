type FormField = { name: string; kind?: string };

export function recordPayload(resource: string, form: Record<string, unknown>, fields: readonly FormField[], editing: boolean) {
  const payload: Record<string, unknown> = {};
  for (const field of fields) {
    const value = form[field.name];
    if (value === undefined) continue;
    if (field.kind === "datetime-local") {
      payload[field.name] = value ? new Date(`${value}:00+07:00`).toISOString() : null;
    } else if (field.kind === "number") {
      payload[field.name] = value === "" || value === null ? null : Number(value);
    } else if (field.kind === "select" && value === "" && ["status", "attendance"].includes(field.name)) {
      continue;
    } else {
      payload[field.name] = value;
    }
  }
  if (resource === "sessions" || resource === "assignments") {
    for (const key of ["learnerId", "groupId"]) {
      if (!payload[key]) {
        if (editing) payload[key] = null;
        else delete payload[key];
      }
    }
  }
  if (resource === "learners" && payload.assignedTeacherId === "") payload.assignedTeacherId = null;
  return payload;
}
