export const SAMPLE_METRICS_TEXT = `# HELP claude_code_session_count_total Count of CLI sessions started
# TYPE claude_code_session_count_total counter
claude_code_session_count_total{start_type="fresh"} 2

# HELP claude_code_cost_usage_usd_total Cost of the Claude Code session in USD
# TYPE claude_code_cost_usage_usd_total counter
claude_code_cost_usage_usd_total{model="claude-sonnet-4-6",query_source="main"} 0.84
claude_code_cost_usage_usd_total{model="claude-opus-4-1",query_source="subagent"} 1.12

# HELP claude_code_token_usage_tokens_total Number of tokens used
# TYPE claude_code_token_usage_tokens_total counter
claude_code_token_usage_tokens_total{type="input",model="claude-sonnet-4-6"} 12654
claude_code_token_usage_tokens_total{type="output",model="claude-sonnet-4-6"} 8110
claude_code_token_usage_tokens_total{type="cacheRead",model="claude-sonnet-4-6"} 4068
claude_code_token_usage_tokens_total{type="cacheCreation",model="claude-sonnet-4-6"} 2122
claude_code_token_usage_tokens_total{type="input",model="claude-opus-4-1"} 5440
claude_code_token_usage_tokens_total{type="output",model="claude-opus-4-1"} 3990

# HELP claude_code_lines_of_code_count_total Count of lines of code modified
# TYPE claude_code_lines_of_code_count_total counter
claude_code_lines_of_code_count_total{type="added"} 220
claude_code_lines_of_code_count_total{type="removed"} 41

# HELP claude_code_commit_count_total Number of git commits created
# TYPE claude_code_commit_count_total counter
claude_code_commit_count_total 3

# HELP claude_code_pull_request_count_total Number of pull requests created
# TYPE claude_code_pull_request_count_total counter
claude_code_pull_request_count_total 1

# HELP claude_code_code_edit_tool_decision_count_total Count of code editing tool permission decisions
# TYPE claude_code_code_edit_tool_decision_count_total counter
claude_code_code_edit_tool_decision_count_total{tool_name="Edit",decision="accept"} 8
claude_code_code_edit_tool_decision_count_total{tool_name="Write",decision="reject"} 1

# HELP claude_code_active_time_total_seconds Total active time in seconds
# TYPE claude_code_active_time_total_seconds counter
claude_code_active_time_total_seconds{type="cli"} 845
claude_code_active_time_total_seconds{type="user"} 177
`;

export const SAMPLE_USAGE_LIMIT = {
  plan: 'Pro',
  label: 'Plan usage limit',
  scope: 'Current session',
  usedPercent: 22,
  resetAt: '2026-04-26T20:00:00+09:00',
  resetLabel: 'Resets in 2 hours',
  statusText: '22% used',
  description: 'Bundled sample payload modeled after the Claude usage settings view.'
};
