export function isGrantScopeValid(input: {
  requestedAgencyId: string;
  accountAgencyId: string | null | undefined;
  memberAgencyId: string | null | undefined;
  memberRole: string | null | undefined;
}) {
  return input.accountAgencyId === input.requestedAgencyId
    && input.memberAgencyId === input.requestedAgencyId
    && input.memberRole === "member";
}
