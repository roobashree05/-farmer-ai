# AI providers

`AI_PROVIDER=mock` answers from active knowledge-base documents inside the API process. It does not call an external model.

`AI_PROVIDER=anthropic` calls Claude. The CRM still keeps the answer inside those documents: new facts and prices are replaced with a quotation or an escalation.
