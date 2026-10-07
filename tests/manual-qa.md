# Manual QA

Run with a development database and two centers. Use separate browser profiles for teacher accounts.

1. Bootstrap the first owner with `npm run db:bootstrap`. Confirm the owner can sign in and that `/register` does not allow signup without an invitation.
2. Create learners assigned to different teachers, make a mixed group, and confirm each teacher sees only their assigned learners in both the group list and roster API. Add and remove learners as a manager.
3. As a manager, assign sessions to a teacher and confirm only that teacher sees them. As a teacher, create a learner session and confirm it is saved with the teacher assigned. Try changing its teacher ID directly and confirm the API rejects it. Schedule one learner session and one group session. Confirm choosing both targets or neither is rejected, end-before-start is rejected, then record attendance and complete the session.
4. Add a lesson plan, session note, assignment, and progress update. Refresh each page and confirm the saved record remains.
5. Invite a colleague as a teacher. Confirm signup without an invitation is rejected, the email link expires after seven days, only the invited email can activate the account, verification is required, and the new user receives the invited role.
6. As a teacher, confirm assigned learner/session data is visible, unassigned learner IDs return 403, and manager-only create/delete operations are rejected. Confirm teachers can only mark assignments complete or reopen them, and cannot set `NEEDS_REVIEW` or alter completion timestamps.
7. As an owner or manager, invite a manager, change a teacher’s role, and remove a team member. Confirm the owner cannot be removed or demoted.
8. Confirm creating a second center is rejected, each account has at most one center membership, and changing resource IDs cannot access other records.
9. Upload common, grade, and class documents. Confirm teachers only see common files and files scoped to their assigned students’ grades/classes. Confirm downloads require membership, manager-only upload/delete rules hold, unsupported/oversize files are rejected, and deleting a class moves its documents to the common library.
10. Check narrow mobile width, empty lists, search with no match, invalid fields, expired invitation, and failed email delivery.
