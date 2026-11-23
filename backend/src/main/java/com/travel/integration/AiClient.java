package com.travel.integration;

import com.travel.dto.AiRequests.*;

/** Replaceable provider boundary; the business service owns draft validation and persistence. */
public interface AiClient { Draft generate(Generate request); }
