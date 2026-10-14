// Auto-generated from extracted configurations. Do not edit manually.

export interface AtsConfig {
  atsName: string;
  urls: string[];
  urlsExclude?: string[];
  submitButtonPaths?: string[];
  nextStepButtonPaths?: string[];
  backStepButtonPaths?: string[];
  validationErrorXPaths?: string[];
  validationErrorPersistent?: boolean;
  validationCheckFormValidity?: boolean;
  errorBannerXPaths?: string[];
  questionValidationErrorSelectors?: string[];
  targetNodeXPath?: string[];
  targetFrameNodeXPath?: string[];
  canJobBeAppliedXPaths?: {
    applyButton?: string[];
    submitButton?: string;
    next?: string[];
    email?: string[];
    refuseAddDevice?: string[];
    [key: string]: any;
  };
  customQuestions?: {
    patterns?: {
      questionId?: string;
      innerSelectors?: string[];
      selectInputTagName?: string;
      selectInputAttrName?: string;
      selectInputAttrValue?: string;
      maxLabelLevel?: string;
      radioGroupAttrName?: string;
      radioGroupAttrValue?: string;
      listboxTagName?: string;
      questionParent?: string;
      fieldsetMatchQuerySelector?: string;
      [key: string]: any;
    };
    selectors?: {
      question?: string;
      title?: string;
      label?: string;
      labelInputGroup?: string;
      legend?: string;
      ariaLabelledBy?: string;
      roleOption?: string;
      radioInput?: string;
      checkbox?: string;
      mapOption?: string;
      formGroup?: string;
      subTitle?: string;
      listOption?: string;
      selectPopup?: string;
      optionsSelector?: string;
      contextSelector?: string;
      [key: string]: any;
    };
    xpaths?: {
      currentListItem?: string[];
      listInputBackBtnText?: string[];
      selectPopupXPath?: string[];
      listBoxPopupXPath?: string[];
      selectedItemListXPath?: string[];
      requiredFieldXPath?: string[];
      requiredTextContent?: string[];
      targetNodeXPath?: string[];
      [key: string]: any;
    };
    ignoreQuestions?: string[];
    ignoreContainerQuestions?: string[];
    handlePseudoCheckboxes?: boolean;
    postSubmitValidationErrors?: string[];
    useSelectorForCustomFields?: boolean;
    maxSelectOptionsCount?: number;
    [key: string]: any;
  };

  /** Config-driven entity definitions: [fieldName, xpathsOrActions, metadata?][] */
  entities?: [string, any, any?][];
  /** Entities to process after LLM fills custom questions. */
  entitiesAfterLLM?: [string, any, any?][];

  /** Pre-apply flow (cookie consent, apply buttons, etc.) */
  preApply?: {
    urls?: string[];
    urlsExclude?: string[];
    entities?: [string, any, any?][];
    continueFilling?: boolean;
    restartAfterDelay?: number;
    forceConditions?: { urls?: string[] };
    [key: string]: any;
  };

  /** Auth flow configuration. */
  signIn?: {
    submitButton?: string[];
    email?: string[];
    password?: string[];
    verifyPassword?: string[];
    urls?: string[];
    createAccount?: string[];
    isInlineForm?: boolean;
    isEmailRequired?: boolean;
    toSignInButton?: string[];
    recaptchaXpath?: string[];
    signInWithEmail?: string[];
    wrongCredentialsError?: string[];
    errorMessage?: string[];
    formStepPath?: string[];
    errorPersistAfterReload?: boolean;
    [key: string]: any;
  };
  signUp?: {
    submitButton?: string[];
    email?: string[];
    verifyEmail?: string[];
    password?: string[];
    verifyPassword?: string[];
    userName?: string[];
    saveStrategy?: string;
    endpoint?: string;
    agreementPath?: string[];
    recaptchaXpath?: string[];
    errorMessage?: string[];
    urls?: string[];
    formStepPath?: string[];
    [key: string]: any;
  };

  /** Submission confirmation detection. */
  confirmSubmittedForm?: {
    confirmMessageXPath?: string[];
    confirmMessageSelector?: string | string[];
    urls?: string[];
    [key: string]: any;
  };

  /** Network filtering options. */
  networkOptions?: {
    blacklistedUrlParts?: string[];
    allowedUrlParts?: string[];
    preApplyCheck?: boolean;
    [key: string]: any;
  };

  /** Global processing options. */
  globalOptions?: {
    waitForAllRequestsBeforeFillingStep?: boolean;
    [key: string]: any;
  };

  /** Job detail XPaths for scraping. */
  jobXPaths?: {
    entities?: [string, string[]][];
    [key: string]: any;
  };

  /** Context classifier data. */
  contextData?: {
    classifier?: {
      applyBtnPath?: string[];
      [key: string]: any;
    };
    options?: Record<string, any>;
    [key: string]: any;
  };

  /** Verification flow after auth. */
  verification?: {
    enabled?: boolean;
    codeConfig?: Record<string, any>;
    [key: string]: any;
  };
  verificationRequired?: {
    errorXPath?: string[];
    [key: string]: any;
  };
  verificationButtonXpaths?: string[];

  /** Expired/closed job detection. */
  expiredJob?: Record<string, {
    container?: string[];
    keywords?: string[];
    urls?: string[];
  }> | Array<{
    container?: string[];
    keywords?: string[];
    urls?: string[];
  }>;

  /** Misc flags. */
  detectPageQuestions?: boolean;
  addQuestionLabelId?: boolean;
  nextStepDynamicLoad?: boolean;
  nextStepButtonFallbackToParentFrame?: boolean;
  monitorSubmitFlow?: boolean;
  waitForSubmitOutcome?: boolean;
  checkForAlreadyAppliedAfterSubmit?: boolean;
  checkForErrorsBeforeNext?: boolean;
  checkErrorsAfterSubmit?: boolean;
  verificationAfterSubmit?: boolean;
  isPreApplyEligible?: boolean;
  isContextClassified?: boolean;
  ignoreInitAnswersNeeded?: boolean;
  questionsInSubmitPage?: boolean;
  clickErrorBannerAfterFailedSubmit?: boolean;
  tabWillNotUpdateAfterSubmit?: boolean;
  forceNewJobSearch?: boolean;
  hiddenElementSelectors?: string;
  pageFailureKeywords?: string[];
  formLoadingXPaths?: string[];
  formLoadingAfterNextStepClick?: boolean;
  formLoadingAfterSubmitClick?: boolean;
  loadingSpinnerXPath?: string[];
  exitModalWindow?: string[];
  attachedContainer?: string[];
  textContentFallbacks?: string[];
  [key: string]: any;
}

export const ATS_CONFIGS: Record<string, AtsConfig> = {
  "adp": {
    "atsName": "adp",
    "urls": [
      "*://recruiting.adp.com/srccar/public/*?appUI*",
      "*://recruiting.adp.com/srccar/public/*&appUI=*",
      "*://recruiting.adp.com/srccar/public/nghome.guid*",
      "*://recruiting.adp.com/srccar/public/RTI.home*"
    ],
    "urlsExclude": [],
    "submitButtonPaths": [
      ".//button[@id='submitBtn']"
    ],
    "nextStepButtonPaths": [
      ".//div[@data-dojo-attach-point='thePagerSingleGo']",
      ".//button[@id='recruitment_jobDescription_apply']"
    ],
    "validationErrorPersistent": true,
    "validationErrorXPaths": [
      ".//div[contains(@class, 'dijitError')]",
      ".//input[contains(@class, 'dijitError')]",
      ".//table[contains(@class, 'dijitError')]"
    ],
    "errorBannerXPaths": [
      ".//div[@role='dialog']//div[text()='Errors Found']"
    ],
    "targetNodeXPath": [
      ".//div[@id='theViewNode']"
    ],
    "questionValidationErrorSelectors": [
      "div[class*='dijitError'] > input, table[class*='dijitError']"
    ],
    "targetFrameNodeXPath": [],
    "customQuestions": {
      "patterns": {
        "maxLabelLevel": "5"
      },
      "selectors": {
        "question": "input[id], textarea[id], table[id], div[class*='dojositeMultiSelect'], div[id^='uniqName_'], div[id^='question_row'], fieldset[class='radio']",
        "title": "div[class='header']",
        "subTitle": "h3",
        "checkbox": "input[type='checkbox']",
        "label": "label"
      },
      "xpaths": {
        "targetNodeXPath": [
          ".//form[@data-dojo-id='theFormNode']"
        ],
        "listBoxPopupXPath": [
          ".//table[@role='listbox' and @id='__id__']//tr//td//span[class='label']",
          ".//table[@role='listbox' and @id='__id__']//tr//td[starts-with(@data-dojo-attach-point, 'containerNode')]"
        ]
      },
      "ignoreQuestions": [
        ".//td[contains(@class, 'dijitButtonContents') and .//input[@name='_dd']]",
        ".//td[contains(@class, 'dijitButtonContents') and .//input[@name='_mm']]"
      ]
    },
    "jobXPaths": {
      "entities": [
        [
          "titleDisplay",
          [
            ".//span[contains(@class, 'jobTitle')]"
          ]
        ],
        [
          "originalCompanyName",
          [
            "substring(normalize-space(.//div[@id='app_body']//span[@class='company-name']/text()), 4)",
            "substring-after(.//meta[(@property='og:site_name' or @name='application-name') and starts-with(@content, 'Careers at ')]/@content, 'Careers at ')",
            ".//meta[@property='og:site_name' or @name='application-name']/@content"
          ]
        ],
        [
          "jobTypes",
          [
            ".//div[text()='Position Type' or text()='Position Status']/following-sibling::*[1]"
          ]
        ],
        [
          "postingDate",
          []
        ],
        [
          "url",
          []
        ],
        [
          "desc",
          [
            ".//div[text()='Job Description']/following-sibling::*[1]"
          ]
        ],
        [
          "locationDisplay",
          [
            ".//i[contains(@class, 'fa-map-mark')]/following-sibling::*[1]",
            ".//div[text()='Location']/following-sibling::*[1]"
          ]
        ]
      ]
    },
    "canJobBeAppliedXPaths": {
      "applyButton": [
        ".//button[contains(., 'Apply') and contains(@class, 'btn-primary')]"
      ]
    },
    "contextData": {
      "classifier": {
        "applyBtnPath": [
          "//a[contains(@href, 'recruiting.adp.com/srccar/public/') and CONTAINS_TEXT('apply', true)]"
        ]
      },
      "options": {}
    },
    "preApply": {
      "urls": [
        "*://*.adp.com/*/*/public/RTI.home*"
      ],
      "entities": [
        [
          "applyBtn",
          {
            "actions": [
              {
                "key": "canJobBeAppliedXPaths.applyButton",
                "method": "click"
              }
            ]
          }
        ],
        [
          "email",
          [
            {
              "actions": [
                {
                  "path": [
                    ".//form[@id='enterEmailForm']//input[@id='email']"
                  ],
                  "method": "setValue"
                },
                {
                  "path": [
                    ".//form[@id='enterEmailForm']//input[@id='enterEmailSubmitButton']"
                  ],
                  "method": "click"
                }
              ]
            }
          ]
        ]
      ]
    },
    "signIn": {
      "urls": [],
      "submitButton": [],
      "createAccount": [],
      "forgotPassword": [],
      "email": [],
      "password": [],
      "errorMessage": [],
      "endpoint": ""
    },
    "signUp": {
      "errorMessage": [],
      "submitButton": [],
      "email": [],
      "password": [],
      "verifyPassword": [],
      "endpoint": ""
    },
    "entities": [
      [
        "answerSource",
        {
          "actions": [
            {
              "path": [
                "//div[contains(@class, 'source_display')]//div[contains(@class, 'sourcerow')][1]//table"
              ],
              "options": {
                "waitForNetworkBeforeInteraction": true
              },
              "method": "click"
            },
            {
              "path": [
                "//div[@dijitpopupparent=//div[contains(@class, 'source_display')]//div[contains(@class, 'sourcerow')][1]//table/@widgetid]"
              ],
              "method": "clickOptionWithMultiAnswers",
              "values": {
                "source": [
                  "Google",
                  "Other",
                  "Internet",
                  "Web",
                  "Board",
                  "website",
                  "social network",
                  "job board",
                  "job site"
                ]
              },
              "options": {
                "lowPriority": [
                  "Indeed",
                  "ZipRecruiter",
                  "LinkedIn",
                  "Glassdoor",
                  "Simplyhired",
                  "Dice",
                  "CareerBuilder",
                  "Monster"
                ],
                "prohibited": [
                  "referral",
                  "referred",
                  "connection",
                  "at the company",
                  "for the organization",
                  "employee",
                  "select",
                  "current worker"
                ],
                "ignoreFirst": true,
                "selectFirstExcludingProhibited": true
              }
            },
            {
              "path": [
                "//div[contains(@class, 'source_display')]//div[contains(@class, 'sourcerow')][2]//table"
              ],
              "method": "click"
            },
            {
              "path": [
                "//div[@dijitpopupparent=//div[contains(@class, 'source_display')]//div[contains(@class, 'sourcerow')][2]//table/@widgetid]"
              ],
              "method": "clickOptionWithMultiAnswers",
              "values": {
                "source": [
                  "Other",
                  "Google"
                ]
              },
              "options": {
                "lowPriority": [
                  "Indeed",
                  "ZipRecruiter",
                  "LinkedIn",
                  "Glassdoor",
                  "Simplyhired",
                  "Dice",
                  "CareerBuilder",
                  "Monster"
                ],
                "prohibited": [
                  "referral",
                  "referred",
                  "connection",
                  "at the company",
                  "for the organization",
                  "employee",
                  "select",
                  "current worker"
                ],
                "ignoreFirst": true,
                "selectFirstExcludingProhibited": true
              }
            },
            {
              "path": [
                "//div[contains(@class, 'source_display')]//div[contains(@class, 'sourcerow')]//input[@type='text' and @value='']"
              ],
              "method": "setValue",
              "defaultValue": "Job Board"
            }
          ]
        }
      ],
      [
        "firstName",
        [
          ".//input[starts-with(@name, 'firstName')]",
          "//input[@id='guestFirstName']"
        ]
      ],
      [
        "lastName",
        [
          ".//input[starts-with(@name, 'lastName')]",
          "//input[@id='guestLastName']"
        ]
      ],
      [
        "email",
        [
          ".//input[starts-with(@name, 'emailAddress')]",
          ".//input[@id='guestEmail']"
        ]
      ],
      [
        "phoneType",
        {
          "actions": [
            {
              "path": [
                ".//label[contains(., 'Phone Type')]/following-sibling::*[1]",
                ".//label[contains(., 'Phone Type')]/following-sibling::*[1]//table"
              ],
              "method": "click"
            },
            {
              "path": [
                ".//table[@id='__ariaOwns__']"
              ],
              "ariaPath": [
                ".//label[contains(., 'Phone Type')]/following-sibling::*[1]",
                ".//label[contains(., 'Phone Type')]/following-sibling::*[1]//table"
              ],
              "values": {
                "mobile": [
                  "Cell Phone"
                ]
              },
              "method": "clickOption",
              "attributes": {
                "ariaOwns": "aria-owns"
              }
            }
          ]
        }
      ],
      [
        "phone",
        [
          ".//input[starts-with(@name, 'phone')]",
          ".//input[@id='login_view_phone']"
        ]
      ],
      [
        "addressType",
        {
          "actions": [
            {
              "path": [
                ".//select[contains(@id, 'PersonProfileFields.AddressType')]"
              ],
              "method": "clickOption",
              "values": {
                "home": [
                  "Home"
                ]
              }
            }
          ]
        }
      ],
      [
        "addressLine1",
        [
          ".//input[starts-with(@name, 'address1')]"
        ]
      ],
      [
        "city",
        [
          ".//input[starts-with(@name, 'city')]"
        ]
      ],
      [
        "postalCode",
        [
          ".//input[starts-with(@name, 'zip')]"
        ]
      ],
      [
        "stateName",
        {
          "actions": [
            {
              "path": [
                ".//label[contains(., 'State')]/following-sibling::*[1]",
                ".//label[contains(., 'State')]/following-sibling::*[1]//table"
              ],
              "method": "click"
            },
            {
              "path": [
                ".//table[@id='__ariaOwns__']"
              ],
              "ariaPath": [
                ".//label[contains(., 'State')]/following-sibling::*[1]",
                ".//label[contains(., 'State')]/following-sibling::*[1]//table"
              ],
              "method": "clickOption",
              "attributes": {
                "ariaOwns": "aria-owns"
              }
            }
          ]
        }
      ],
      [
        "resume",
        [
          ".//div[@name='desktopButton' and contains(@id, 'resume')]//input[@type='file' and contains(@name, 'resume')]"
        ]
      ],
      [
        "experience",
        {
          "addButtonPath": [
            ".//div[@id='theAddRepeatButton' and contains(., 'Add Employer')]"
          ],
          "containerPath": [
            "//div[@id='_eformrender_repeat___indexPlusOne__' and not(@style[contains(., 'display: none')]) and descendant::label[contains(., 'Employer')]]",
            "//div[@id='_eformrender_repeat___indexPlusOne__' and descendant::label[contains(., 'Employer')]]"
          ],
          "entities": [
            [
              "title",
              [
                ".//input[starts-with(@name, '$$employerEndTitle')]"
              ]
            ],
            [
              "companyName",
              [
                ".//input[starts-with(@name, '$$employerName')]"
              ]
            ],
            [
              "city",
              [
                ".//input[starts-with(@name, '$$employerCity')]"
              ]
            ],
            [
              "reasonLeaving",
              [
                ".//textarea[starts-with(@name, '$$employerReasonForLeaving')]"
              ]
            ],
            [
              "country",
              {
                "actions": [
                  {
                    "path": [
                      ".//label[contains(., 'Country')]/table",
                      ".//label[contains(., 'Country')]/following-sibling::*[1]//table"
                    ],
                    "method": "click"
                  },
                  {
                    "path": [
                      ".//table[@id='__ariaOwns__']"
                    ],
                    "ariaPath": [
                      ".//label[contains(., 'Country')]/table",
                      ".//label[contains(., 'Country')]/following-sibling::*[1]//table"
                    ],
                    "method": "clickOption",
                    "options": {
                      "containerElement": "document"
                    },
                    "attributes": {
                      "ariaOwns": "aria-owns"
                    },
                    "values": {
                      "": [
                        "United States"
                      ],
                      "United States": [
                        "United States"
                      ]
                    }
                  }
                ]
              }
            ],
            [
              "stateName",
              {
                "actions": [
                  {
                    "path": [
                      ".//label[contains(., 'State')]/following-sibling::*[1]//table"
                    ],
                    "method": "click"
                  },
                  {
                    "path": [
                      ".//table[@id='__ariaOwns__']"
                    ],
                    "ariaPath": [
                      ".//label[contains(., 'State')]/following-sibling::*[1]//table"
                    ],
                    "method": "clickOption",
                    "options": {
                      "containerElement": "document"
                    },
                    "attributes": {
                      "ariaOwns": "aria-owns"
                    }
                  }
                ]
              }
            ],
            [
              "startDate",
              [
                ".//input[starts-with(@name, '$$employerStartDate')]/preceding-sibling::*[2]"
              ]
            ],
            [
              "startDateSlashes_MMDDYYYY",
              {
                "actions": [
                  {
                    "path": [
                      ".//input[contains(@name, 'employerStartDate___indexPlusOne___RTiCandidateDate')]"
                    ],
                    "method": "click"
                  },
                  {
                    "path": [
                      ".//input[contains(@name, 'employerStartDate___indexPlusOne___RTiCandidateDate')]"
                    ],
                    "method": "setValue"
                  }
                ]
              }
            ],
            [
              "endDate",
              [
                ".//input[starts-with(@name, '$$employerEndDate')]/preceding-sibling::*[2]"
              ]
            ],
            [
              "isCurrent",
              {
                "actions": [
                  {
                    "path": [
                      ".//div[contains(@data-dojosite-fld, 'employerType')]//table"
                    ],
                    "method": "click"
                  },
                  {
                    "path": [
                      ".//table[@id='__ariaOwns__']"
                    ],
                    "ariaPath": [
                      ".//div[contains(@data-dojosite-fld, 'employerType')]//table"
                    ],
                    "method": "clickOption",
                    "values": {
                      "true": [
                        "Current"
                      ],
                      "false": [
                        "Previous"
                      ],
                      "": [
                        "No Previous Work Experience"
                      ]
                    },
                    "options": {
                      "containerElement": "document"
                    },
                    "attributes": {
                      "ariaOwns": "aria-owns"
                    }
                  }
                ]
              }
            ],
            [
              "mayWeContact",
              {
                "actions": [
                  {
                    "path": [
                      ".//label[contains(., 'May We Contact')]/following-sibling::*[1]//table"
                    ],
                    "method": "click"
                  },
                  {
                    "path": [
                      ".//table[@id='__ariaOwns__']"
                    ],
                    "ariaPath": [
                      ".//label[contains(., 'May We Contact')]/following-sibling::*[1]//table"
                    ],
                    "method": "clickOption",
                    "values": {
                      "true": [
                        "Yes"
                      ],
                      "false": [
                        "No"
                      ]
                    },
                    "options": {
                      "containerElement": "document"
                    },
                    "attributes": {
                      "ariaOwns": "aria-owns"
                    }
                  }
                ]
              }
            ],
            [
              "description",
              [
                ".//textarea[starts-with(@name, '$$employerJobDuties')]"
              ]
            ]
          ]
        }
      ],
      [
        "education",
        {
          "addButtonPath": [
            ".//div[@id='theAddRepeatButton' and contains(., 'Add Education')]"
          ],
          "containerPath": [
            ".//div[@id='_eformrender_repeat___indexPlusOne__' and descendant::label[contains(., 'Education Level')]]"
          ],
          "entities": [
            [
              "name",
              [
                ".//input[starts-with(@name, '$$educationSchoolName')]"
              ]
            ],
            [
              "city",
              [
                ".//input[starts-with(@name, '$$educationCity')]"
              ]
            ],
            [
              "major",
              [
                ".//input[starts-with(@name, '$$educationMajor')]"
              ]
            ],
            [
              "degree",
              {
                "actions": [
                  {
                    "path": [
                      ".//label[contains(., 'Education Level')]/following-sibling::*[1]//table"
                    ],
                    "method": "click"
                  },
                  {
                    "path": [
                      ".//table[@id='__ariaOwns__']"
                    ],
                    "ariaPath": [
                      ".//label[contains(., 'Education Level')]/following-sibling::*[1]//table"
                    ],
                    "method": "clickOption",
                    "values": {
                      "bachelor's": [
                        "Bachelor",
                        "Bachelor's Level Degree"
                      ],
                      "master's": [
                        "Master",
                        "Master's Level Degree"
                      ],
                      "associate": [
                        "2 - Year College Degree",
                        "Associate",
                        "Some Graduate School"
                      ],
                      "doctorate": [
                        "Doctorate"
                      ],
                      "highschool": [
                        "High School",
                        "Some High School",
                        "HS Graduate or Equivalent"
                      ],
                      "High School / GED": [
                        "High School",
                        "Some High School"
                      ]
                    },
                    "options": {
                      "containerElement": "document"
                    },
                    "attributes": {
                      "ariaOwns": "aria-owns"
                    }
                  }
                ]
              }
            ],
            [
              "country",
              {
                "actions": [
                  {
                    "path": [
                      ".//label[contains(., 'Country')]/table",
                      ".//label[contains(., 'Country')]/following-sibling::*[1]//table"
                    ],
                    "method": "click"
                  },
                  {
                    "path": [
                      ".//table[@id='__ariaOwns__']"
                    ],
                    "ariaPath": [
                      ".//label[contains(., 'Country')]/table",
                      ".//label[contains(., 'Country')]/following-sibling::*[1]//table"
                    ],
                    "method": "clickOption",
                    "options": {
                      "containerElement": "document"
                    },
                    "attributes": {
                      "ariaOwns": "aria-owns"
                    }
                  }
                ]
              }
            ],
            [
              "stateName",
              {
                "actions": [
                  {
                    "path": [
                      ".//label[contains(., 'State')]/table",
                      ".//label[contains(., 'State')]/following-sibling::*[1]//table"
                    ],
                    "method": "click"
                  },
                  {
                    "path": [
                      ".//table[@id='__ariaOwns__']"
                    ],
                    "ariaPath": [
                      ".//label[contains(., 'State')]/table",
                      ".//label[contains(., 'State')]/following-sibling::*[1]//table"
                    ],
                    "method": "clickOption",
                    "options": {
                      "containerElement": "document"
                    },
                    "attributes": {
                      "ariaOwns": "aria-owns"
                    }
                  }
                ]
              }
            ],
            [
              "isCurrent",
              {
                "actions": [
                  {
                    "path": [
                      ".//label[contains(., 'Graduated?')]/following-sibling::*[1]//table"
                    ],
                    "method": "click"
                  },
                  {
                    "path": [
                      ".//table[@id='__ariaOwns__']"
                    ],
                    "ariaPath": [
                      ".//label[contains(., 'Graduated?')]/following-sibling::*[1]//table"
                    ],
                    "method": "clickOption",
                    "values": {
                      "true": [
                        "No"
                      ],
                      "false": [
                        "Yes"
                      ]
                    },
                    "options": {
                      "containerElement": "document"
                    },
                    "attributes": {
                      "ariaOwns": "aria-owns"
                    }
                  }
                ]
              }
            ]
          ]
        }
      ],
      [
        "gender",
        {
          "actions": [
            {
              "path": [
                ".//fieldset[@for='eeoGender']"
              ],
              "method": "clickOption",
              "values": {
                "Male": [
                  "Male",
                  "Man"
                ],
                "Female": [
                  "Female",
                  "Woman"
                ],
                "Other": [
                  "Other"
                ],
                "Decline to identify": [
                  "Decline to identify",
                  "Decline",
                  "I don't wish",
                  "Prefer not",
                  "Opt Out"
                ]
              }
            }
          ]
        }
      ],
      [
        "deviceType",
        {
          "actions": [
            {
              "path": [
                ".//div[text()='Phone Type']/following-sibling::*[1]"
              ],
              "method": "click",
              "delay": 200
            },
            {
              "path": [
                ".//div[starts-with(@class, 'dijitPopup')]//table[@role='listbox']//td[contains(., 'Cell')]"
              ],
              "method": "click"
            }
          ]
        }
      ],
      [
        "hispanicLatino",
        {
          "actions": [
            {
              "path": [
                ".//span[contains(., 'Are you Hispanic or Latino?')]/.."
              ],
              "method": "clickOption",
              "values": {
                "true": [
                  "Yes",
                  "Hispanic"
                ],
                "false": [
                  "No",
                  "Not Hispanic",
                  "Prefer not"
                ],
                "": [
                  "Decline",
                  "No",
                  "I don't wish",
                  "Prefer not",
                  "Decline To Identify"
                ]
              }
            }
          ]
        }
      ],
      [
        "over18",
        {
          "actions": [
            {
              "path": [
                ".//div[contains(., 'Are you at least 18 years of age?')]/..",
                ".//div[@id='question_row_238816215']//div[contains(@class, 'required') and contains(text(), 'Are you at least 18 years of age?')]"
              ],
              "method": "clickOption",
              "values": {
                "true": [
                  "Yes"
                ],
                "false": [
                  "No"
                ]
              }
            }
          ]
        }
      ],
      [
        "birthDay",
        {
          "actions": [
            {
              "path": [
                ".//td[contains(@class, 'dijitButtonContents') and .//input[@name='_dd']]"
              ],
              "method": "click"
            },
            {
              "path": [
                ".//td[contains(@class, 'dijitMenuItemLabel')]//span[text() = '__birthDay__\u00a0']"
              ],
              "method": "click"
            }
          ]
        }
      ],
      [
        "birthMonth",
        {
          "actions": [
            {
              "path": [
                ".//td[contains(@class, 'dijitButtonContents') and .//input[@name='_mm']]"
              ],
              "method": "click"
            },
            {
              "path": [
                ".//table[@id='_mm_menu']"
              ],
              "method": "clickOption",
              "values": {
                "1": [
                  "Jan",
                  "January",
                  "01"
                ],
                "2": [
                  "Feb",
                  "February",
                  "02"
                ],
                "3": [
                  "Mar",
                  "March",
                  "03"
                ],
                "4": [
                  "Apr",
                  "April",
                  "04"
                ],
                "5": [
                  "May",
                  "05"
                ],
                "6": [
                  "Jun",
                  "June",
                  "06"
                ],
                "7": [
                  "Jul",
                  "July",
                  "07"
                ],
                "8": [
                  "Aug",
                  "August",
                  "08"
                ],
                "9": [
                  "Sep",
                  "September",
                  "09"
                ],
                "10": [
                  "Oct",
                  "October",
                  "10"
                ],
                "11": [
                  "Nov",
                  "November",
                  "11"
                ],
                "12": [
                  "Dec",
                  "December",
                  "12"
                ]
              }
            }
          ]
        }
      ],
      [
        "country",
        {
          "actions": [
            {
              "path": [
                ".//label[contains(., 'Country')]/table",
                ".//label[contains(., 'Country')]/following-sibling::*[1]//table"
              ],
              "method": "prefilled"
            }
          ]
        }
      ],
      [
        "county",
        {
          "actions": [
            {
              "path": [
                ".//label[text()='County']/following-sibling::*[1]"
              ],
              "method": "prefilled"
            }
          ]
        }
      ]
    ]
  },
  "adp_v2": {
    "atsName": "adp_v2",
    "urls": [
      "*://workforcenow.adp.com/*/recruitment/postLogin.html*"
    ],
    "urlsExclude": [],
    "submitButtonPaths": [
      ".//button[contains(@class, 'wizard-submit-button')]"
    ],
    "nextStepButtonPaths": [
      ".//sdf-button[@id='recruitment_login_recaptcha']",
      ".//button[contains(@class, 'wizard-next-button')]"
    ],
    "verificationButtonXpaths": [
      "//button[contains(@class, 'vdl-button')]"
    ],
    "validationErrorPersistent": false,
    "questionsInSubmitPage": true,
    "alwaysSyncWindowId": true,
    "detectPageQuestions": true,
    "forceNewJobSearch": true,
    "stopWaitingUserInteractionsInPreApply": true,
    "validationErrorXPaths": [
      ".//h4[@id='addressErrorMessage']",
      ".//h4[contains(@class, 'error')]",
      "//div[contains(@class, 'experience-vdl-error-label')]",
      "//wfn-text[@role='alert' and contains(translate(normalize-space(.), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'invalid')]"
    ],
    "errorBannerXPaths": [],
    "targetNodeXPath": [
      ".//div[contains(@class, 'job-Application-wizard-container')]",
      ".//div[@name='jobDescriptionView']"
    ],
    "formLoadingXPaths": [
      ".//div[@id='recPageLoadWaitingIndicator' and not(contains(@style, 'display: none;'))]",
      ".//sdf-busy-indicator"
    ],
    "verificationRequired": {
      "errorXPath": [
        ".//sdf-focus-pane[@heading='Enter the Verification Code']"
      ]
    },
    "expiredJob": [
      {
        "container": [
          ".//h1",
          ".//h2"
        ],
        "keywords": [
          "current openings",
          "current job openings",
          "no current openings.",
          "open positions"
        ]
      }
    ],
    "verification": {
      "enabled": true,
      "interval": 15000,
      "maxDuration": 120000,
      "codeConfig": [
        {
          "type": "single",
          "inputs": [
            "//input[@id='oneTimePassWord']"
          ],
          "confirmButton": [
            "//button[@id='recruitment_login_verifyOTP']"
          ]
        }
      ]
    },
    "questionValidationErrorSelectors": [
      "input[class*='vdl-validation-error']",
      "div[class*='vdl-validation-error'] > input",
      "textarea[class*='question-error']",
      "div[class*='question-error vdl-dropdown-list']"
    ],
    "targetFrameNodeXPath": [],
    "customQuestions": {
      "patterns": {
        "radioGroupAttrName": "class",
        "radioGroupAttrValue": "prop_group radio-question",
        "listboxTagName": "div",
        "selectInputAttrName": "role",
        "selectInputAttrValue": "combobox",
        "selectInputTagNames": [
          "input",
          "div"
        ]
      },
      "selectors": {
        "title": "h3",
        "roleOption": "[role='option'], [role='radio']",
        "checkbox": "input[type='checkbox']",
        "label": "label[class*='qLabel'], span[class*='qLabel'], label[for^='checkbox_'], label[id^='race_'], label[class='required']"
      },
      "xpaths": {
        "targetNodeXPath": [
          ".//div[contains(@class, 'job-Application-wizard-container')]",
          ".//div[@name='jobDescriptionView']"
        ],
        "listBoxPopupXPath": [
          ".//ul[@role='listbox']"
        ],
        "selectPopupXPath": [
          ".//div[@role='combobox']"
        ],
        "requiredFieldXPath": [
          ".//span[contains(@class, 'required')]"
        ],
        "requiredTextContent": [
          "required",
          "if yes"
        ]
      },
      "ignoreQuestions": [
        ".//label[contains(., 'County')]/parent::div/following-sibling::input"
      ]
    },
    "jobXPaths": {
      "entities": [
        [
          "titleDisplay",
          [
            ".//h2[contains(@class, 'job-description-title')]"
          ]
        ],
        [
          "originalCompanyName",
          []
        ],
        [
          "jobTypes",
          []
        ],
        [
          "postingDate",
          [
            ".//span[contains(@class, 'job-description-post-date')]"
          ]
        ],
        [
          "location",
          [
            ".//div[contains(@class, 'job-description-location')]"
          ]
        ],
        [
          "url",
          []
        ],
        [
          "desc",
          [
            ".//div[contains(@class, 'job-description-data')]"
          ]
        ],
        [
          "locationDisplay",
          [
            ".//div[contains(@class, 'job-description-location')]"
          ]
        ]
      ]
    },
    "canJobBeAppliedXPaths": {
      "applyButton": [
        ".//button[contains(@class, 'job-description-apply') and contains(@class, 'vdl-button--primary')]"
      ]
    },
    "contextData": {
      "classifier": {
        "applyBtnPath": [
          "//a[contains(@href, 'workforcenow.adp.com') and CONTAINS_TEXT('apply', true)]"
        ]
      },
      "options": {}
    },
    "preApply": {
      "urls": [
        "*://workforcenow.adp.com/*/recruitment/recruitment.html*"
      ],
      "entities": [
        [
          "applyBtn",
          {
            "actions": [
              {
                "key": "canJobBeAppliedXPaths.applyButton",
                "method": "click",
                "time": 500
              }
            ]
          }
        ],
        [
          "consent",
          {
            "actions": [
              {
                "path": [
                  ".//sdf-focus-pane[@heading='Privacy Policy']//sdf-button[@aria-label='Consent & Continue']"
                ],
                "method": "click",
                "time": 500
              }
            ]
          }
        ],
        [
          "firstName",
          [
            ".//input[@id='guestFirstName']"
          ]
        ],
        [
          "lastName",
          [
            ".//input[@id='guestLastName']"
          ]
        ],
        [
          "email",
          [
            ".//input[@id='guestEmail']"
          ]
        ],
        [
          "phoneStrippedCountryCode",
          {
            "actions": [
              {
                "path": [
                  ".//input[@id='login_view_phone']"
                ],
                "method": "setValue",
                "options": {
                  "triggerBlurEvent": true,
                  "triggerInputEvent": true,
                  "triggerChangeEvent": true,
                  "ignoreExistingValue": true,
                  "triggerKeyDownEvent": true,
                  "appendToExistingValue": true
                }
              }
            ]
          }
        ],
        [
          "validationError",
          {
            "actions": [
              {
                "path": [
                  ".//*[contains(@class, 'experience-vdl-error-label') and contains(., 'required')]"
                ],
                "method": "checkValidationError"
              }
            ]
          }
        ],
        [
          "continueButton",
          {
            "actions": [
              {
                "path": [
                  ".//sdf-button[@aria-label='Continue']"
                ],
                "method": "click",
                "time": 500
              }
            ]
          }
        ],
        [
          "chooseVerificationMethod",
          {
            "actions": [
              {
                "path": [
                  ".//sdf-focus-pane[@heading='Get your verification code']//wfn-radio-button[@value='EMAIL']"
                ],
                "method": "clickInShadowRoot",
                "options": {
                  "shadowRootSelector": "sdf-radio-button"
                },
                "time": 1000
              }
            ]
          }
        ],
        [
          "sendButton",
          {
            "actions": [
              {
                "path": [
                  ".//sdf-focus-pane[@heading='Get your verification code']//sdf-button[@aria-label='Send']"
                ],
                "method": "click",
                "time": 500
              }
            ]
          }
        ]
      ]
    },
    "entities": [
      [
        "applyBtn",
        {
          "actions": [
            {
              "key": "canJobBeAppliedXPaths.applyButton",
              "method": "click",
              "time": 500
            }
          ]
        },
        {
          "keywords": [
            "apply"
          ]
        }
      ],
      [
        "privacyAgreement",
        {
          "actions": [
            {
              "path": [
                "//div[@id='self_att_agree_chk']/input"
              ],
              "method": "click"
            }
          ]
        },
        {
          "keywords": [
            "agreement"
          ]
        }
      ],
      [
        "firstName",
        [
          "//input[@id='personalInfomationFirstName']"
        ],
        {
          "keywords": [
            "first name"
          ]
        }
      ],
      [
        "lastName",
        [
          "//input[@id='personalInfomationLastName']"
        ],
        {
          "keywords": [
            "last name"
          ]
        }
      ],
      [
        "fullName",
        [
          "//input[@id='electronicSignature']"
        ],
        {
          "keywords": [
            "full name",
            "sign electronically"
          ]
        }
      ],
      [
        "email",
        [
          ".//input[@id='personalInfomationEmail']"
        ],
        {
          "keywords": [
            "email"
          ]
        }
      ],
      [
        "phoneStripped",
        {
          "actions": [
            {
              "path": [
                ".//input[@id='personalInfomationMobileNumberError']"
              ],
              "method": "setValue",
              "options": {
                "triggerBlurEvent": true,
                "triggerInputEvent": true,
                "triggerChangeEvent": true,
                "ignoreExistingValue": true,
                "triggerKeyDownEvent": true,
                "appendToExistingValue": true
              }
            }
          ]
        },
        {
          "keywords": [
            "mobile number"
          ]
        }
      ],
      [
        "homePhoneStripped",
        {
          "actions": [
            {
              "path": [
                ".//input[translate(@labeltext, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz') = 'home phone number']"
              ],
              "method": "setValue",
              "options": {
                "triggerBlurEvent": true,
                "triggerInputEvent": true,
                "triggerChangeEvent": true,
                "ignoreExistingValue": true,
                "triggerKeyDownEvent": true,
                "appendToExistingValue": true
              }
            }
          ]
        },
        {
          "keywords": [
            "home phone number"
          ]
        }
      ],
      [
        "country",
        {
          "resetFields": [
            "city",
            "stateName",
            "postalCode"
          ],
          "actions": [
            {
              "path": [
                ".//label[contains(., 'Country')]/parent::div/following-sibling::*[1]//input"
              ],
              "method": "click"
            },
            {
              "path": [
                ".//div[@id='__ariaOwns__']"
              ],
              "ariaPath": [
                ".//label[contains(., 'Country')]/parent::div/following-sibling::*[1]//input"
              ],
              "method": "clickOption",
              "options": {
                "containerElement": "document"
              },
              "attributes": {
                "ariaOwns": "aria-controls"
              },
              "values": {
                "": [
                  "united states"
                ],
                "united states": [
                  "united states"
                ]
              }
            }
          ]
        },
        {
          "keywords": [
            "country"
          ]
        }
      ],
      [
        "addressLine1",
        {
          "actions": [
            {
              "path": [
                ".//input[contains(@id, 'PersonalAddress') and @aria-required='true' and @autocomplete]"
              ],
              "method": "setValue"
            }
          ]
        },
        {
          "keywords": [
            "address line 1",
            "country",
            "phone number"
          ]
        }
      ],
      [
        "workAuth",
        {
          "actions": [
            {
              "path": [
                ".//label[contains(text(), 'Are you legally authorized to work in the United States?')]/ancestor::div[contains(@class, 'question-label-container')]/following-sibling::div//div[@class='vdl-dropdown-list__input']"
              ],
              "method": "click"
            },
            {
              "path": [
                ".//ul[@id='__ariaOwns__']"
              ],
              "ariaPath": [
                ".//div[contains(@labelText, 'authorized')]"
              ],
              "method": "clickOption",
              "options": {
                "containerElement": "document"
              },
              "attributes": {
                "ariaOwns": "aria-controls"
              }
            }
          ]
        },
        {
          "keywords": [
            "authorized to work"
          ]
        }
      ],
      [
        "city",
        [
          ".//label[contains(., 'City')]/parent::div/following-sibling::input"
        ],
        {
          "keywords": [
            "country"
          ]
        }
      ],
      [
        "stateName",
        {
          "actions": [
            {
              "path": [
                ".//div[contains(@labelText, 'State')]"
              ],
              "method": "click"
            },
            {
              "path": [
                ".//ul[@id='__ariaOwns__']"
              ],
              "ariaPath": [
                ".//div[contains(@labelText, 'State')]"
              ],
              "method": "clickOption",
              "options": {
                "containerElement": "document"
              },
              "attributes": {
                "ariaOwns": "aria-controls"
              }
            }
          ]
        },
        {
          "keywords": [
            "country"
          ]
        }
      ],
      [
        "postalCode",
        [
          ".//label[contains(., 'Postal Code') or contains(., 'Zip Code')]/parent::div/following-sibling::input"
        ],
        {
          "keywords": [
            "country",
            "postal code",
            "zip code"
          ]
        }
      ],
      [
        "resume",
        [
          ".//div[contains(@class, 'upload-resume-content')]//input[@type='file']"
        ],
        {
          "keywords": [
            "resume"
          ]
        }
      ],
      [
        "gender",
        {
          "actions": [
            {
              "path": [
                ".//input[@id='vsidGender']"
              ],
              "method": "click"
            },
            {
              "path": [
                ".//div[@id='__ariaOwns__']"
              ],
              "ariaPath": [
                ".//input[@id='vsidGender']"
              ],
              "method": "clickOption",
              "options": {
                "containerElement": "document"
              },
              "attributes": {
                "ariaOwns": "aria-controls"
              },
              "values": {
                "male": [
                  "Male",
                  "Man"
                ],
                "female": [
                  "Female",
                  "Woman"
                ],
                "other": [
                  "Other",
                  "Prefer not to say"
                ],
                "decline to identify": [
                  "Decline to identify",
                  "Decline",
                  "I don't wish",
                  "Prefer not to say",
                  "Opt Out"
                ]
              }
            }
          ]
        },
        {
          "keywords": [
            "gender"
          ]
        }
      ],
      [
        "hispanicLatino",
        {
          "actions": [
            {
              "path": [
                ".//input[@id='vsidEthinicity']"
              ],
              "method": "click"
            },
            {
              "path": [
                ".//div[@id='__ariaOwns__']"
              ],
              "ariaPath": [
                ".//input[@id='vsidEthinicity']"
              ],
              "method": "clickOption",
              "options": {
                "containerElement": "document"
              },
              "attributes": {
                "ariaOwns": "aria-controls"
              },
              "values": {
                "true": [
                  "Hispanic or Latino"
                ],
                "false": [
                  "Not Hispanic or Latino"
                ]
              }
            }
          ]
        },
        {
          "keywords": [
            "ethnicity"
          ]
        }
      ],
      [
        "disability",
        {
          "actions": [
            {
              "path": [
                ".//div[@id='disabilityStatusCheck']//input[@type='checkbox']",
                ".//input[@name='disabilityStatusCheck']"
              ],
              "method": "click",
              "time": 500
            },
            {
              "path": [
                ".//div[contains(@class, 'vsid-status-question-block')]"
              ],
              "method": "clickOptionInShadowRoot",
              "options": {
                "listItemOutsideShadowRoot": "wfn-radio-button",
                "listItemInsideShadowRoot": "sdf-radio-button"
              },
              "values": {
                "true": [
                  "Yes, I Have a Disability, or Have a History/Record of Having a Disability"
                ],
                "false": [
                  "No, I Don\u2019t Have a Disability, or a History/Record of Having a Disability"
                ],
                "": [
                  "I Don\u2019t Wish to Answer"
                ]
              },
              "time": 500
            }
          ]
        },
        {
          "keywords": [
            "disability"
          ]
        }
      ],
      [
        "answerSource",
        {
          "actions": [
            {
              "path": [
                ".//input[@aria-label='Please indicate how you heard about this position.']"
              ],
              "method": "click"
            },
            {
              "path": [
                ".//div[@id='__ariaOwns__']"
              ],
              "ariaPath": [
                ".//input[@aria-label='Please indicate how you heard about this position.']"
              ],
              "method": "clickOption",
              "defaultValue": "Other",
              "attributes": {
                "ariaOwns": "aria-controls"
              },
              "values": {
                "source": [
                  "Other",
                  "Internet",
                  "Google"
                ]
              }
            }
          ]
        },
        {
          "keywords": [
            "heard about"
          ]
        }
      ],
      [
        "currencyType",
        [
          {
            "actions": [
              {
                "path": [
                  ".//sdf-select-simple[contains(@placeholder, 'Select currency type')]"
                ],
                "method": "clickInShadowRoot",
                "options": {
                  "shadowRootSelector": "div[aria-haspopup='listbox']"
                }
              },
              {
                "path": [
                  ".//sdf-select-simple[contains(@placeholder, 'Select currency type')]"
                ],
                "method": "clickOptionInShadowRoot",
                "defaultValue": "USD",
                "options": {
                  "shadowRootSelector": "sdf-floating-pane",
                  "listItemSelector": "sdf-select-item"
                },
                "values": {
                  "USD": [
                    "USD",
                    "US Dollar",
                    "United States Dollar (USD)"
                  ],
                  "CAD": [
                    "CAD",
                    "Canadian Dollar",
                    "Canadian Dollar (CAD)"
                  ]
                }
              }
            ]
          },
          {
            "actions": [
              {
                "path": [
                  ".//input[@type='text' and contains(@id, 'currency_type')]"
                ],
                "method": "click"
              },
              {
                "path": [
                  ".//input[@type='text' and contains(@id, 'currency_type')]"
                ],
                "method": "setValue",
                "defaultValue": "USD",
                "options": {
                  "triggerBlurEvent": false,
                  "triggerInputEvent": true,
                  "triggerChangeEvent": true,
                  "ignoreExistingValue": true,
                  "triggerKeyDownEvent": true,
                  "appendToExistingValue": true
                },
                "time": 500
              },
              {
                "path": [
                  ".//div[contains(@class, 'MDFSelect') and @role='listbox']"
                ],
                "method": "clickOption",
                "defaultValue": "USD",
                "values": {
                  "USD": [
                    "USD",
                    "US Dollar",
                    "United States Dollar (USD)"
                  ],
                  "CAD": [
                    "CAD",
                    "Canadian Dollar",
                    "Canadian Dollar (CAD)"
                  ]
                }
              }
            ]
          }
        ],
        {
          "keywords": [
            "salary",
            "currency"
          ]
        }
      ],
      [
        "minYearlySalaryDesired",
        [
          ".//input[@id='desiredSalaryId']"
        ],
        {
          "keywords": [
            "salary"
          ]
        }
      ],
      [
        "veteran",
        {
          "actions": [
            {
              "path": [
                ".//h4[contains(., 'Protected Veteran Status')]//following-sibling::*[3]"
              ],
              "method": "clickOption",
              "options": {
                "isOptionShadowRoot": true,
                "optionSelector": "sdf-radio-button"
              },
              "values": {
                "true": [
                  "I identify myself as one or more of the classifications of protected veteran."
                ],
                "false": [
                  "I am not a protected veteran.",
                  "I decline to self-identify."
                ]
              }
            }
          ]
        },
        {
          "keywords": [
            "veteran"
          ]
        }
      ]
    ]
  },
  "ashbyhq": {
    "atsName": "ashbyhq",
    "urls": [
      "*://*.ashbyhq.com/*/*/application",
      "*://jobs.ashbyhq.com/*/*/application"
    ],
    "urlsExclude": [],
    "networkOptions": {
      "blacklistedUrlParts": [
        "linkedin",
        "analytics",
        "insights",
        "collect",
        "datadoghq",
        "non-user",
        "blob"
      ],
      "allowedUrlParts": [],
      "preApplyCheck": false
    },
    "detectPageQuestions": true,
    "addQuestionLabelId": false,
    "submitButtonPaths": [
      "//button[.//span[text()='Submit Application']] "
    ],
    "nextStepButtonPaths": [],
    "validationErrorXPaths": [
      "//div[@role='alert']"
    ],
    "validationCheckFormValidity": false,
    "monitorSubmitFlow": true,
    "waitForSubmitOutcome": true,
    "tabWillNotUpdateAfterSubmit": true,
    "errorBannerXPaths": [
      "//div[@role='alert']"
    ],
    "questionValidationErrorSelectors": [
      "div[role='alert']"
    ],
    "confirmSubmittedForm": {
      "confirmMessageXPath": [
        "//div[@role='status' and contains(@class, 'ashby-application-form-success-container')]"
      ],
      "urls": [],
      "confirmMessageSelector": "[h2*='Success']"
    },
    "targetNodeXPath": [
      ".//div[contains(@class,'ashby-job-posting-right-pane')]"
    ],
    "targetFrameNodeXPath": [],
    "expiredJob": [
      {
        "container": [
          "//div[contains(@class, 'container')]"
        ],
        "keywords": [
          "job not found",
          "was not found"
        ]
      }
    ],
    "canJobBeAppliedXPaths": {
      "applyButton": [
        "//button[contains(text(), 'Apply')]"
      ],
      "submitButton": "",
      "options": {
        "checkApplyBtnOutsideIframe": false
      },
      "refuseAddDevice": [],
      "email": [],
      "next": []
    },
    "customQuestions": {
      "patterns": {
        "questionId": "",
        "innerSelectors": [],
        "fieldsetMatchQuerySelector": "",
        "questionParent": "",
        "selectInputXPath": [],
        "selectInputTagName": "",
        "selectInputAttrName": "",
        "selectInputAttrValue": "",
        "radioGroupMatchQuerySelector": "",
        "maxLabelLevel": "",
        "radioGroupAttrName": "",
        "radioGroupAttrValue": "",
        "listboxTagName": "",
        "selectInputTagNames": []
      },
      "selectors": {
        "question": "div[class*='fieldEntry'] > div[class*='container'], div[class*='fieldEntry'] > input, div[class*='fieldEntry'] > div > input,  div[class*='fieldEntry'] > textarea,  fieldset[class*='fieldEntry'], input[type='text']",
        "subTitle": "div[class*='description']",
        "label": "label[class*='question-title'], label[for*='labeled-checkbox']",
        "legend": "legend",
        "optionsSelector": "button[class*='option'], div[class*='option']",
        "mapOption": "div[role='option']",
        "listOption": "div[class*='resultContainer']",
        "title": "div[class*='sectionHeader']"
      },
      "xpaths": {
        "currentListItem": [],
        "listInputBackBtnText": [],
        "selectPopupXPath": [],
        "listBoxPopupXPath": [],
        "selectedItemListXPath": [],
        "requiredFieldXPath": [
          "self::*[contains(@class, 'required')]"
        ],
        "requiredTextContent": [],
        "targetNodeXPath": []
      },
      "ignoreQuestions": [
        "//div[contains(@class, 'fieldEntry')]//div[contains(@class, 'container') and .//input[contains(@id, 'resume') and @type='file']]",
        "//div[contains(@class, 'fieldEntry')]//div[contains(@class, 'container') and .//input[contains(@id, 'cover_letter') and @type='file']]",
        "//div//label[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'company') and not(translate(normalize-space(text()), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz') = 'current company')]/following-sibling::input",
        "//div//label[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'position') and not(translate(normalize-space(text()), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz') = 'notice to start a new position')]/following-sibling::input",
        "//div//label[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'responsibilities')]/following-sibling::textarea",
        "//div//label[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'reason') and contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'leaving')]/following-sibling::input"
      ],
      "ignoreContainerQuestions": [],
      "useSelectorForCustomFields": false
    },
    "jobXPaths": {
      "entities": [
        [
          "titleDisplay",
          [
            "//h1[contains(@class, 'title')]"
          ]
        ],
        [
          "originalCompanyName",
          [
            "//a[contains(translate(@class, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'logo')]/img/@alt"
          ]
        ],
        [
          "jobTypes",
          [
            "//div[h2[normalize-space(text())='Employment Type']]/p"
          ]
        ],
        [
          "url",
          [
            ".//meta[@property='og:url']/@content"
          ]
        ],
        [
          "desc",
          [
            ".//div[contains(@class,'descriptionText')]"
          ]
        ],
        [
          "locationDisplay",
          [
            "//div[h2[normalize-space(text())='Location']]/p"
          ]
        ]
      ]
    },
    "contextData": {
      "classifier": {
        "applyBtnPath": [
          "//button[contains(text(), 'Apply for this')]"
        ]
      },
      "options": {}
    },
    "preApply": {
      "urls": [
        "*://*.ashbyhq.com/*/*"
      ],
      "entities": [
        [
          "applyButton",
          {
            "actions": [
              {
                "key": "canJobBeAppliedXPaths.applyButton",
                "method": "click"
              }
            ]
          },
          {
            "keywords": [
              "Apply"
            ]
          }
        ]
      ],
      "urlsExclude": [],
      "continueFilling": true
    },
    "entities": [
      [
        "answerSource",
        []
      ],
      [
        "firstName",
        [
          "//div[label[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'first name')]]//input[contains(@id, 'systemfield_name')]"
        ],
        {
          "keywords": [
            "first name"
          ]
        }
      ],
      [
        "lastName",
        []
      ],
      [
        "preferredFirstName",
        []
      ],
      [
        "legalFirstName",
        []
      ],
      [
        "legalLastName",
        []
      ],
      [
        "fullName",
        {
          "actions": [
            {
              "path": [
                "//div[label[not(contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'first name'))]]//input[contains(@id, 'systemfield_name')]"
              ],
              "method": "setValue",
              "options": {
                "triggerBlurEvent": false
              }
            }
          ]
        },
        {
          "keywords": [
            "name"
          ]
        }
      ],
      [
        "email",
        {
          "actions": [
            {
              "path": [
                "//input[contains(@id, 'systemfield_email')]"
              ],
              "method": "setValue",
              "options": {
                "triggerBlurEvent": false
              }
            }
          ]
        },
        {
          "keywords": [
            "email"
          ]
        }
      ],
      [
        "phoneFormatted",
        {
          "actions": [
            {
              "path": [
                "//input[@id='phone']",
                "//input[@type='tel']"
              ],
              "method": "setValue",
              "options": {
                "triggerChangeEvent": true,
                "triggerBlurEvent": false
              }
            }
          ]
        },
        {
          "keywords": [
            "phone"
          ]
        }
      ],
      [
        "phoneStripped",
        {
          "actions": [
            {
              "path": [
                "//div[label[contains(text(), 'Phone Number')]]//input[@type='number']"
              ],
              "method": "setValue",
              "options": {
                "triggerChangeEvent": true,
                "triggerBlurEvent": false
              }
            }
          ]
        },
        {
          "keywords": [
            "phone"
          ]
        }
      ],
      [
        "addressLine1",
        []
      ],
      [
        "state",
        {
          "actions": [
            {
              "path": [
                "//div[label[contains(text(), 'State')]]//input"
              ],
              "method": "setValue"
            }
          ]
        },
        {
          "keywords": [
            "state"
          ]
        }
      ],
      [
        "stateName",
        {
          "actions": [
            {
              "path": [
                "//fieldset[label[contains(text(), 'state of residency')]]//input",
                "//label[contains(., 'state')]/following-sibling::div[contains(@class, 'inputContainer')]//input"
              ],
              "method": "setValue"
            },
            {
              "path": [
                "//fieldset[label[contains(text(), 'state of residency')]]//input",
                "//label[contains(., 'state')]/following-sibling::div[contains(@class, 'inputContainer')]//input"
              ],
              "method": "pressEnterKey",
              "options": {
                "waitForNetworkBeforeInteraction": true
              }
            }
          ]
        },
        {
          "keywords": [
            "state of residency",
            "U.S. state"
          ]
        }
      ],
      [
        "postalCode",
        {
          "actions": [
            {
              "path": [
                "//div[label[contains(text(), 'Zip Code')]]//input"
              ],
              "method": "setValue"
            }
          ]
        },
        {
          "keywords": [
            "zip code"
          ]
        }
      ],
      [
        "country",
        {
          "actions": [
            {
              "path": [
                "//label[contains(text(), 'Nationality / Citizenship')]/following::input[1]",
                "//div[label[contains(text(), 'which country will you be based')]]//input",
                "//div[label[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), ' country of residence')]]//input",
                "//div[label[contains(translate(normalize-space(.), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'based')] and (.//text()[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'only country')])]//input[@role='combobox']"
              ],
              "method": "setValue",
              "time": 500
            },
            {
              "path": [
                "//div[@role='listbox']//div[contains(@class, 'resultContainer')]"
              ],
              "method": "clickOption",
              "options": {
                "waitForNetworkBeforeInteraction": true
              }
            },
            {
              "path": [
                "//label[contains(text(), 'Nationality / Citizenship')]/following::input[1]",
                "//div[label[contains(text(), 'which country will you be based')]]//input",
                "//div[label[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), ' country of residence')]]//input"
              ],
              "method": "pressEnterKey"
            }
          ]
        },
        {
          "keywords": [
            "nationality",
            "citizenship",
            "country will you be based",
            "only country"
          ]
        }
      ],
      [
        "cityStateName",
        {
          "actions": [
            {
              "path": [
                "//div[label[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'which city and state do you')]]//input",
                "//div[label[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'city, state')]]//input",
                "//div[label[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'location')]]//input[@role='combobox']",
                "//div[label[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'city') and not(contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'city, state')) and not(contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'which city and state do you currently reside'))]]//input[@role='combobox']",
                "//div[label[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'which country will you work')]]//input[@role='combobox']",
                "//div[label[contains(translate(normalize-space(.), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'based')] and not(.//text()[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'only country')])]//input[@role='combobox']",
                "//div[label[contains(translate(normalize-space(.), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'where') and contains(translate(normalize-space(.), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'located')]]//input[@role='combobox']",
                "//div[label[contains(translate(normalize-space(text()), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'reside')]]//input[not(@type='checkbox')]",
                "//div[h2[translate(normalize-space(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz') = 'candidate physical location']]/following-sibling::div//label[not(normalize-space())]/following-sibling::div//input"
              ],
              "method": "setValue",
              "options": {
                "waitForNetworkAfterInteraction": true,
                "checkForValue": true
              },
              "time": 750
            },
            {
              "path": [
                "//div[@role='listbox']//div[contains(@class, 'resultContainer')]"
              ],
              "method": "clickOption",
              "options": {
                "waitForNetworkBeforeInteraction": true,
                "fallbackOption": "United States",
                "rerunFallbackValue": true
              }
            },
            {
              "path": [
                "//div[label[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'location')]]//input[@role='combobox']"
              ],
              "method": "pressEnterKey"
            }
          ]
        },
        {
          "keywords": [
            "country",
            "location",
            "city",
            "based",
            "located",
            "reside"
          ]
        }
      ],
      [
        "education",
        {
          "addButtonPath": [],
          "confirmAddedPath": [],
          "containerPath": [],
          "options": {
            "getRelevantEntities": false
          },
          "entities": [
            [
              "name",
              []
            ],
            [
              "degree",
              []
            ],
            [
              "major",
              []
            ],
            [
              "startDateMonth_MM",
              []
            ],
            [
              "endDateMonth_MM",
              []
            ],
            [
              "startDateMonthText",
              []
            ],
            [
              "endDateMonthText",
              []
            ],
            [
              "startDateYear",
              []
            ],
            [
              "endDateYear",
              []
            ]
          ]
        }
      ],
      [
        "recentExperience.companyName",
        {
          "actions": [
            {
              "path": [
                "//div[div[h2[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'most recent job')]]]//label[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'company name')]/following-sibling::input",
                "//label[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'most recent company')]/following-sibling::input"
              ],
              "method": "setValue"
            }
          ]
        },
        {
          "keywords": [
            "most recent"
          ]
        }
      ],
      [
        "experience",
        {
          "addButtonPath": [],
          "confirmAddedPath": [],
          "containerPath": [
            "//div[contains(@class, 'form-section-container')][.//h2[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'job')]]"
          ],
          "options": {
            "getRelevantEntities": true
          },
          "entities": [
            [
              "companyName",
              {
                "actions": [
                  {
                    "path": [
                      "(//div[div[h2[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'job')]]]//label[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'company') and contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'name')]/following-sibling::input)[__indexPlusOne__]"
                    ],
                    "method": "setValue"
                  }
                ]
              },
              {
                "keywords": [
                  "company name"
                ]
              }
            ],
            [
              "cityState",
              {
                "actions": [
                  {
                    "path": [
                      "(//div[div[h2[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'job')]]]//label[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'company located')]/following-sibling::div//input)[__indexPlusOne__]"
                    ],
                    "method": "setValue",
                    "time": 1000
                  },
                  {
                    "path": [
                      "//div[@role='listbox']//div[contains(@class, 'resultContainer')]"
                    ],
                    "method": "clickOption",
                    "options": {
                      "waitForNetworkBeforeInteraction": true
                    }
                  },
                  {
                    "path": [
                      "(//div[div[h2[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'job')]]]//label[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'company located')]/following-sibling::div//input)[__indexPlusOne__]"
                    ],
                    "method": "pressEnterKey"
                  }
                ]
              },
              {
                "keywords": [
                  "company located"
                ]
              }
            ],
            [
              "title",
              {
                "actions": [
                  {
                    "path": [
                      "(//div[div[h2[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'job')]]]//label[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'position')]/following-sibling::input)[__indexPlusOne__]"
                    ],
                    "method": "setValue"
                  }
                ]
              },
              {
                "keywords": [
                  "position",
                  "title"
                ]
              }
            ],
            [
              "startDateSlashes_MMDDYYYY",
              {
                "actions": [
                  {
                    "path": [
                      "(//div[div[h2[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'job')]]]//label[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'begin working')]/following-sibling::div//input)[__indexPlusOne__]"
                    ],
                    "method": "setValue"
                  },
                  {
                    "actions": [
                      {
                        "path": [
                          "//div[contains(@class, 'datepicker')]//div[contains(@class, 'selected')]"
                        ],
                        "method": "clickOption"
                      }
                    ]
                  }
                ]
              },
              {
                "keywords": [
                  "start date",
                  "begin working"
                ]
              }
            ],
            [
              "isCurrent",
              {
                "actions": [
                  {
                    "path": [
                      "(//div[div[h2[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'most recent job')]]]//label[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'still')]/following-sibling::div)[__indexPlusOne__]"
                    ],
                    "method": "clickOption",
                    "values": {
                      "true": [
                        "Yes"
                      ],
                      "false": [
                        "No"
                      ]
                    }
                  }
                ]
              },
              {
                "keywords": [
                  "still employed"
                ]
              }
            ],
            [
              "endDateSlashes_MMDDYYYY",
              {
                "actions": [
                  {
                    "path": [
                      "(//div[div[h2[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'job')]]]//label[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'ended your employment')]/following-sibling::div//input)[__indexPlusOne__]"
                    ],
                    "method": "setValue"
                  },
                  {
                    "path": [
                      "//div[contains(@class, 'datepicker')]//div[contains(@class, 'selected')]"
                    ],
                    "method": "clickOption"
                  }
                ]
              },
              {
                "keywords": [
                  "end date",
                  "ended your employment"
                ]
              }
            ],
            [
              "description",
              {
                "actions": [
                  {
                    "path": [
                      "(//div[div[h2[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'job')]]]//label[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'responsibilities')]/following-sibling::textarea)[__indexPlusOne__]"
                    ],
                    "method": "setValue"
                  }
                ]
              },
              {
                "keywords": [
                  "responsibilities"
                ]
              }
            ],
            [
              "reasonLeaving",
              {
                "actions": [
                  {
                    "path": [
                      "(//div[div[h2[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'job')]]]//label[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'reason for leaving') or contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'why did you leave')]/following-sibling::input)[__indexPlusOne__]"
                    ],
                    "method": "setValue"
                  }
                ]
              },
              {
                "keywords": [
                  "Reason for Leaving "
                ]
              }
            ]
          ]
        },
        {
          "keywords": [
            "recent job",
            "previous job"
          ]
        }
      ],
      [
        "over18",
        {
          "actions": [
            {
              "path": [
                "//div[label[contains(text(), '18 years')]]//div[contains(@class, 'container')]"
              ],
              "method": "clickOption",
              "values": {
                "true": [
                  "Yes"
                ],
                "false": [
                  "No"
                ]
              }
            }
          ]
        },
        {
          "keywords": [
            "18 years"
          ]
        }
      ],
      [
        "weekdaysAvailability",
        {}
      ],
      [
        "weekendsAvailability",
        {}
      ],
      [
        "openSchedule",
        {}
      ],
      [
        "flexibleSchedule",
        {}
      ],
      [
        "dayShift",
        {}
      ],
      [
        "nightShift",
        {}
      ],
      [
        "swingShift",
        {}
      ],
      [
        "overnightShift",
        {}
      ],
      [
        "anyShift",
        {}
      ],
      [
        "lift50PoundsWeightAbility",
        {}
      ],
      [
        "agreement",
        []
      ],
      [
        "hispanicLatino",
        {}
      ],
      [
        "genderPronouns",
        {}
      ],
      [
        "transgender",
        {}
      ],
      [
        "veteran",
        {
          "actions": [
            {
              "path": [
                "//fieldset[label[contains(text(), 'Veteran')]]"
              ],
              "method": "clickOption",
              "values": {
                "true": [
                  "I am a ",
                  "I identify ",
                  "Yes"
                ],
                "false": [
                  "I am not a ",
                  "I don't ",
                  "No",
                  "Prefer not"
                ],
                "": [
                  "I decline",
                  "I am not a ",
                  "I don't ",
                  "No",
                  "Prefer not"
                ]
              }
            }
          ]
        },
        {
          "keywords": [
            "veteran"
          ]
        }
      ],
      [
        "disability",
        []
      ],
      [
        "sexualOrientation",
        {}
      ],
      [
        "github",
        []
      ],
      [
        "twitter",
        []
      ],
      [
        "behance",
        []
      ],
      [
        "countryName",
        []
      ],
      [
        "county",
        {}
      ],
      [
        "phoneCode",
        []
      ],
      [
        "phoneType",
        {}
      ],
      [
        "certification",
        {
          "addButtonPath": [],
          "options": {
            "afterAddButtonAsyncDelay": 30000
          },
          "confirmAddedPath": [],
          "containerPath": [],
          "entities": [
            [
              "name",
              []
            ],
            [
              "issueDateSlashes_MMDDYYYY",
              []
            ]
          ]
        }
      ],
      [
        "skill",
        {
          "containerPath": [],
          "entities": [
            [
              "name",
              []
            ]
          ],
          "options": {
            "clickOutsideAtEnd": false
          }
        }
      ],
      [
        "lgbt",
        {}
      ],
      [
        "armedForces",
        {}
      ],
      [
        "currentDate",
        []
      ],
      [
        "currentDateDashes",
        {}
      ],
      [
        "workStartDateAvailabilityString",
        {
          "actions": [
            {
              "path": [
                "//label[contains(text(), 'When can you start a new role')]/following::input[1]",
                "//label[contains(text(), 'approximate start date')]/following::input[1]",
                "//label[contains(text(), 'start working')]/following::input[1]"
              ],
              "method": "setValue"
            },
            {
              "path": [
                "//label[contains(text(), 'When can you start a new role')]/following::input[1]",
                "//label[contains(text(), 'approximate start date')]/following::input[1]",
                "//label[contains(text(), 'start working')]/following::input[1]"
              ],
              "method": "pressEnterKey"
            }
          ]
        },
        {
          "keywords": [
            "when can you start a new role",
            "approximate start date",
            "start working"
          ]
        }
      ],
      [
        "language",
        {}
      ],
      [
        "privacyAgreement",
        {
          "actions": [
            {
              "path": [
                "//div[contains(@class, 'phoneNumberConsent')]//div[contains(@class, 'container')]//label[.//strong[normalize-space(text())='No']]//input"
              ],
              "method": "click"
            }
          ]
        },
        {
          "keywords": [
            "privacy agreement",
            "consent to"
          ]
        }
      ],
      [
        "street",
        []
      ],
      [
        "cityLocated",
        []
      ],
      [
        "birthDate",
        {}
      ],
      [
        "phoneFormatted",
        []
      ],
      [
        "homePhoneFormatted",
        []
      ],
      [
        "workPhoneFormatted",
        []
      ],
      [
        "reference",
        {}
      ],
      [
        "referral",
        {}
      ],
      [
        "applyDate",
        {}
      ],
      [
        "minYearlySalaryDesired",
        []
      ],
      [
        "birthMonth",
        {}
      ],
      [
        "birthDay",
        {}
      ],
      [
        "birthYear",
        {}
      ],
      [
        "addressType",
        {}
      ],
      [
        "nameInitials",
        []
      ],
      [
        "startMonthAvailabilityString",
        {}
      ],
      [
        "startDayAvailabilityString",
        {}
      ],
      [
        "startYearAvailabilityString",
        []
      ],
      [
        "workStartDateFormatted.startDateMonthAbbr",
        {}
      ],
      [
        "currentDate.currentDateMonthAbbr",
        {}
      ],
      [
        "currentDate.dayOfTheMonthNoZeroPad",
        {}
      ],
      [
        "currentDate.currentDateYear",
        {}
      ],
      [
        "deviceType",
        {}
      ],
      [
        "recentExperience.startDate",
        []
      ],
      [
        "recentExperience.endDate",
        []
      ],
      [
        "cityStateName",
        []
      ],
      [
        "phoneAreaCode",
        []
      ],
      [
        "phonePrefix",
        []
      ],
      [
        "phoneLineNumber",
        []
      ],
      [
        "currentDate.dateString",
        []
      ],
      [
        "highestEducation.name",
        []
      ],
      [
        "highestEducation.degreeDisplay",
        []
      ],
      [
        "workStartDateFormatted.startDateDashes_YYYYMMDD",
        []
      ],
      [
        "currencyType",
        {}
      ],
      [
        "startMonthNameAvailabilityString",
        {}
      ],
      [
        "languages",
        {
          "addButtonPath": [],
          "containerPath": [],
          "confirmAddedPath": [],
          "entryContainer": {
            "title": [],
            "subtitle": []
          },
          "options": {
            "clickOutsideAtEnd": false,
            "checkElementVisibility": false,
            "containerInModal": false
          },
          "time": 1500,
          "entities": [
            [
              "language",
              []
            ],
            [
              "speaking",
              []
            ],
            [
              "reading",
              []
            ],
            [
              "writting",
              []
            ],
            [
              "nextBtn",
              []
            ],
            [
              "checkErrors",
              []
            ]
          ]
        }
      ],
      [
        "disabilitySignature",
        {}
      ],
      [
        "middleName",
        {}
      ],
      [
        "addressLine2",
        []
      ],
      [
        "workStartDateAvailability",
        []
      ],
      [
        "highestEducationLevel",
        {}
      ],
      [
        "willingToWorkHolidays",
        {}
      ],
      [
        "employmentInvoluntarilyTerminated",
        {}
      ],
      [
        "headline",
        []
      ],
      [
        "summary",
        []
      ],
      [
        "resume",
        {
          "actions": [
            {
              "path": [
                "//input[contains(@id, 'systemfield_resume')]"
              ],
              "method": "uploadResume"
            }
          ]
        },
        {
          "keywords": [
            "resume",
            "cv"
          ]
        }
      ]
    ],
    "globalOptions": {
      "waitForAllRequestsBeforeFillingStep": false,
      "waitForInteractionNetworkRequests": false
    },
    "backStepButtonPaths": [],
    "backStepDiscardButtonPaths": [],
    "autoFillOptions": {
      "patterns": {
        "date": [],
        "fillAtEnd": []
      },
      "dateOrder": [],
      "selectors": {
        "date": ""
      },
      "settings": {
        "date": {
          "mode": ""
        }
      }
    },
    "pageFailureKeywords": [],
    "verificationRequired": {
      "errorXPath": []
    },
    "formatElements": "",
    "signIn": {
      "urls": [],
      "formPath": [],
      "submitButton": [],
      "toSignInButton": [],
      "createAccount": [],
      "forgotPassword": [],
      "email": [],
      "password": [],
      "errorMessage": [],
      "endpoint": "",
      "isEmailRequired": false,
      "verifyPassword": [],
      "isInlineForm": false,
      "errorPersistAfterReload": false,
      "recaptchaXpath": []
    },
    "signUp": {
      "errorMessage": [],
      "submitButton": [],
      "formStepPath": [],
      "email": [],
      "password": [],
      "verifyPassword": [],
      "endpoint": "",
      "saveStrategy": "",
      "agreementPath": [],
      "urls": [],
      "verifyEmail": [],
      "userName": [],
      "recaptchaXpath": []
    },
    "screenshot": {
      "hide": []
    },
    "alwaysSyncWindowId": true,
    "verification": {
      "enabled": false
    },
    "nextStepButtonFallbackToParentFrame": false,
    "validationErrorPersistent": false,
    "stepsNavigation": {
      "containerPath": [],
      "stepSelector": [],
      "stepClickableSelector": [],
      "activeStepSelector": []
    },
    "attachedContainer": [],
    "questionsInSubmitPage": false,
    "disableBeforeUnloadEvent": false,
    "ignoreInitAnswersNeeded": false,
    "formLoadingXPaths": [],
    "formLoadingAfterNextStepClick": false,
    "nextStepDynamicLoad": false,
    "forceNewJobSearch": false,
    "stopWaitingUserInteractionsInPreApply": false,
    "exitModalWindow": [],
    "clickErrorBannerAfterFailedSubmit": false,
    "validateUsingQuestionErrorSelectors": false,
    "formLoadingAfterSubmitClick": false,
    "checkErrorsAfterSubmit": false,
    "textContentFallbacks": []
  },
  "bamboohr": {
    "atsName": "bamboohr",
    "urls": [
      "*://*.bamboohr.com/careers/*"
    ],
    "detectPageQuestions": true,
    "submitButtonPaths": [
      ".//button[contains(., 'Submit Application')]"
    ],
    "validationCheckFormValidity": false,
    "waitForSubmitOutcome": false,
    "backStepButtonPaths": [],
    "backStepDiscardButtonPaths": [],
    "validationErrorXPaths": [
      "//div[contains(@id, 'status-message') and @role='region']",
      "//p[text()='Please fill in this field.']",
      "//p[text()='Please make a selection.']",
      "//p[text()='Please upload a file']",
      "//p[contains(@data-fabric-component,'BodyText') and (contains(.,'robot') or contains(.,'not a robot') or contains(.,'confirm'))]"
    ],
    "captchaXpath": [],
    "networkOptions": {
      "blacklistedUrlParts": [
        "linkedin",
        "analytics",
        "insights",
        "collect"
      ]
    },
    "pageFailureKeywords": [],
    "monitorSubmitFlow": true,
    "tabWillNotUpdateAfterSubmit": true,
    "errorBannerXPaths": [
      "//div[contains(@id, 'status-message') and @role='region']",
      "//p[text()='Please fill in this field.']",
      "//p[text()='Please make a selection.']",
      "//p[text()='Please upload a file']",
      "//p[contains(@data-fabric-component,'BodyText') and (contains(.,'robot') or contains(.,'not a robot') or contains(.,'confirm'))]"
    ],
    "confirmSubmittedForm": {
      "confirmMessageXPath": [
        ".//h3[contains(., 'Thank You')]",
        ".//p[contains(., 'submitted successfully')]"
      ],
      "urls": [
        "*://*.bamboohr.com/careers/*"
      ],
      "confirmMessageSelector": "div > div:has(> svg + div > h3, > svg + div > p)"
    },
    "questionValidationErrorSelectors": [
      "div[id*='status-message'][role='region']"
    ],
    "targetNodeXPath": [
      "//main[@id='micro-container2']"
    ],
    "expiredJob": [
      {
        "container": [
          ".//h1",
          ".//h2"
        ],
        "keywords": [
          "current openings"
        ]
      }
    ],
    "forceNewJobSearch": false,
    "canJobBeAppliedXPaths": {
      "applyButton": []
    },
    "formatElements": "",
    "customQuestions": {
      "patterns": {
        "questionId": "",
        "questionParent": "",
        "selectInputXPath": [
          ".//div[@role='button' and @tabindex='0']"
        ]
      },
      "selectors": {
        "question": "div[role='radiogroup'], input[type='text']:not([aria-hidden]):not([tabindex='-1']):not([readonly]), textarea[id]:not([aria-hidden]):not([tabindex='-1']):not([readonly]), input[type='checkbox']:not([aria-hidden]):not([tabindex='-1']):not([readonly]), div[role='button'][tabindex='0']",
        "subTitle": "",
        "label": "label",
        "legend": "legend",
        "ariaLabelledBy": "",
        "roleOption": "div[role='menuitem'], div[role='option']",
        "radioInput": "input[type='radio']",
        "checkbox": "input[type='checkbox']",
        "questionParent": "fieldset[role='radiogroup'], div[data-fabric-component*='SelectField']",
        "mapOption": "div[class*='MenuOption__row']",
        "optionsSelector": "div[class*='MenuOption__row']",
        "selectPopup": "div[role='menu'][id='__controls__'], div[role='listbox'][id='__controls__']"
      },
      "xpaths": {
        "currentListItem": [],
        "listInputBackBtnText": [],
        "selectPopupXPath": [],
        "listBoxPopupXPath": [],
        "selectedItemListXPath": [],
        "requiredFieldXPath": [
          ".//span[contains(@class, 'MuiFormLabel-asterisk')]"
        ]
      },
      "ignoreQuestions": [
        "//input[@name='streetAddress.value']",
        "//input[@name='city.value']",
        "//input[@name='zip.value']",
        ".//button[contains(@aria-label, 'State \u2013Select\u2013')]",
        ".//div[contains(@aria-label, 'State \u2013Select\u2013') and @role='button']",
        ".//div[contains(@aria-label, 'Country ') and @role='button']"
      ]
    },
    "jobXPaths": {
      "entities": [
        [
          "titleDisplay",
          [
            ".//h3[1]"
          ]
        ],
        [
          "originalCompanyName",
          [
            ".//img/@alt"
          ]
        ],
        [
          "jobTypes",
          [
            "((.//div[@data-fabric-component='Flex' and contains(., 'Employment Type')])[last()])//div[2]//p"
          ]
        ],
        [
          "url",
          [
            ".//meta[@property='og:url']/@content"
          ]
        ],
        [
          "desc",
          [
            ".//div[@class='BambooRichText']"
          ]
        ],
        [
          "locationDisplay",
          [
            "((.//div[@data-fabric-component='Flex' and contains(., 'Location')])[last()])//div[2]//p"
          ]
        ]
      ]
    },
    "preApply": {
      "urls": [
        "*://*.bamboohr.com/careers/*"
      ],
      "entities": [
        [
          "applyButton",
          {
            "actions": [
              {
                "path": [
                  ".//button[@data-bi-id='careers-site-apply-button']"
                ],
                "method": "click",
                "options": {
                  "wait": 1000
                }
              }
            ]
          },
          {
            "keywords": [
              "apply"
            ]
          }
        ]
      ],
      "forceConditions": {
        "urls": [
          "*://*.bamboohr.com/careers/*"
        ]
      },
      "continueFilling": true
    },
    "entities": [
      [
        "firstName",
        [
          ".//input[@name='firstName']"
        ],
        {
          "keywords": [
            "first name"
          ]
        }
      ],
      [
        "lastName",
        [
          ".//input[@name='lastName']"
        ],
        {
          "keywords": [
            "last name"
          ]
        }
      ],
      [
        "email",
        [
          ".//input[@name='email']"
        ],
        {
          "keywords": [
            "email"
          ]
        }
      ],
      [
        "phoneFormatted",
        {
          "actions": [
            {
              "path": [
                ".//input[@name='phone']"
              ],
              "method": "setValue"
            }
          ]
        },
        {
          "keywords": [
            "phone"
          ]
        }
      ],
      [
        "addressLine1",
        {
          "actions": [
            {
              "path": [
                ".//input[@name='streetAddress.value']"
              ],
              "method": "setValue",
              "options": {
                "ignoreExistingValue": true
              }
            }
          ]
        },
        {
          "keywords": [
            "address"
          ]
        }
      ],
      [
        "city",
        {
          "actions": [
            {
              "path": [
                ".//input[@name='city.value']"
              ],
              "method": "setValue",
              "options": {
                "ignoreExistingValue": true
              }
            }
          ]
        },
        {
          "keywords": [
            "city"
          ]
        }
      ],
      [
        "stateName",
        {
          "actions": [
            {
              "path": [
                ".//button[contains(@aria-label, 'State \u2013Select\u2013')]",
                ".//div[contains(@aria-label, 'State \u2013Select\u2013') and @role='button']"
              ],
              "method": "click"
            },
            {
              "path": [
                ".//div[@data-menu-id=//button[contains(@aria-label, 'State \u2013Select\u2013')]/@aria-controls]//div[@role='menu']",
                ".//div[@id=//div[contains(@aria-label, 'State \u2013Select\u2013') and @role='button']/@data-menu-id and @role='menu']"
              ],
              "method": "clickOption"
            }
          ]
        },
        {
          "keywords": [
            "state"
          ]
        }
      ],
      [
        "postalCode",
        {
          "actions": [
            {
              "path": [
                ".//input[@name='zip.value']"
              ],
              "method": "setValue",
              "options": {
                "ignoreExistingValue": true
              }
            }
          ]
        },
        {
          "keywords": [
            "zip"
          ]
        }
      ],
      [
        "resume",
        {
          "actions": [
            {
              "path": [
                "(.//input[@name='resumeFileId']/ancestor::*[@data-fabric-component='FileUpload'][1])//input[@type='file' and @aria-label='file-input']"
              ],
              "method": "uploadResume"
            }
          ]
        },
        {
          "keywords": [
            "resume"
          ]
        }
      ],
      [
        "minYearlySalaryDesired",
        {
          "actions": [
            {
              "path": [
                ".//input[@name='desiredPay']"
              ],
              "method": "setValue"
            }
          ]
        },
        {
          "keywords": [
            "desired pay",
            "salary"
          ]
        }
      ],
      [
        "linkedin",
        {
          "actions": [
            {
              "path": [
                ".//input[@name='linkedinUrl']"
              ],
              "method": "setValue"
            }
          ]
        },
        {
          "keywords": [
            "linkedin"
          ]
        }
      ],
      [
        "sponsorship",
        {
          "actions": [
            {
              "path": [
                ".//fieldset[contains(., 'sponsorship')]//div[@role='radiogroup']"
              ],
              "method": "clickOption",
              "values": {
                "true": "Yes",
                "false": "No"
              }
            }
          ]
        },
        {
          "keywords": [
            "sponsorship"
          ]
        }
      ],
      [
        "highestEducation.name",
        {
          "actions": [
            {
              "path": [
                "//button[contains(translate(@aria-label,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'highest education obtained')]"
              ],
              "method": "click",
              "options": {
                "wait": 500
              }
            },
            {
              "path": [
                "//div[contains(@aria-owns, 'menu')]"
              ],
              "method": "clickOption",
              "options": {
                "optionMapper": true
              }
            }
          ]
        },
        {
          "keywords": [
            "Highest Education"
          ]
        }
      ]
    ],
    "alwaysSyncWindowId": true
  },
  "breezyhr": {
    "atsName": "breezyhr",
    "urls": [
      "*://*.breezy.hr/p/*/apply/*"
    ],
    "detectPageQuestions": true,
    "highPriority": [
      "resume"
    ],
    "submitButtonPaths": [
      "//li[not(contains(@class, 'ng-hide'))]//button[. = 'Submit Application']"
    ],
    "nextStepButtonPaths": [
      "//li[not(contains(@class, 'ng-hide'))]//button[. = 'Continue']"
    ],
    "backStepButtonPaths": [
      "//li[not(contains(@class, 'ng-hide'))]//button[. = 'Back']"
    ],
    "textContentFallbacks": [],
    "monitorSubmitFlow": true,
    "validationCheckFormValidity": false,
    "waitForSubmitOutcome": true,
    "checkForAlreadyAppliedAfterSubmit": true,
    "backStepDiscardButtonPaths": [],
    "validationErrorXPaths": [
      "//div[contains(@class, 'error-container') and not(contains(@class, 'ng-hide'))]"
    ],
    "captchaXpath": [],
    "networkOptions": {
      "blacklistedUrlParts": []
    },
    "pageFailureKeywords": [],
    "errorBannerXPaths": [],
    "confirmSubmittedForm": {
      "confirmMessageXPath": [
        "//div[@class='confirmation-container']"
      ],
      "urls": [
        "*://*.breezy.hr/p/*/apply/submitted"
      ],
      "confirmMessageSelector": [
        "[class='confirmation-container']"
      ]
    },
    "questionValidationErrorSelectors": [],
    "targetNodeXPath": [
      ".//div[contains(@class, 'content-container')]",
      "//div[@class='confirmation-container']",
      "//div[contains(@class, 'body-wrapper')]"
    ],
    "expiredJob": [
      {
        "container": [],
        "keywords": []
      }
    ],
    "forceNewJobSearch": false,
    "canJobBeAppliedXPaths": {
      "applyButton": []
    },
    "formatElements": "",
    "customQuestions": {
      "patterns": {
        "questionId": "",
        "questionParent": "",
        "radioGroupMatchQuerySelector": "ul ul:has(> li:not([ng-repeat*='.work_history']):not([ng-repeat*='.education']) input[type='radio'])",
        "fieldsetMatchQuerySelector": "ul ul:has(> li:not([ng-repeat*='.work_history']):not([ng-repeat*='.education']) input[type='checkbox'])",
        "selectInputXPath": [
          "//div[contains(@class, 'dropdown-container')]"
        ]
      },
      "selectors": {
        "question": "input[type='text'], textarea:not([ng-model*='.summary']), textarea[name='cSummary'], ul ul:has(> li:not([ng-repeat*='.work_history']):not([ng-repeat*='.education']) input:is([type='radio'],[type='checkbox'])), .dropdown-container",
        "subTitle": "h2",
        "label": "label, span",
        "legend": "legend",
        "ariaLabelledBy": "",
        "roleOption": "li",
        "radioInput": "input[type='radio']",
        "checkbox": "input[type='checkbox']",
        "optionsSelector": "li",
        "listOption": "option",
        "questionParent": "",
        "mapOption": "",
        "selectPopup": ""
      },
      "xpaths": {
        "currentListItem": [],
        "listInputBackBtnText": [],
        "selectPopupXPath": [],
        "listBoxPopupXPath": [],
        "selectedItemListXPath": [],
        "requiredFieldXPath": [
          ".//span[contains(@class, 'required')]"
        ]
      },
      "ignoreQuestions": []
    },
    "jobXPaths": {
      "entities": [
        [
          "titleDisplay",
          [
            "//title"
          ]
        ],
        [
          "originalCompanyName",
          [
            "//ul[@class='meta']//li[@class='department']"
          ]
        ],
        [
          "jobTypes",
          [
            "//ul[@class='meta']//li[@class='type']"
          ]
        ],
        [
          "url",
          [
            "//meta[@property='og:url']"
          ]
        ],
        [
          "desc",
          [
            "//div[@class='container-wrapper']//div[@class='description']"
          ]
        ],
        [
          "locationDisplay",
          [
            "//ul[@class='meta']//li[@class='location']"
          ]
        ]
      ]
    },
    "signIn": {
      "urls": [],
      "formPath": [],
      "submitButton": [],
      "toSignInButton": [],
      "createAccount": [],
      "signInWithEmail": [],
      "forgotPassword": [],
      "email": [],
      "password": [],
      "errorMessage": [],
      "endpoint": ""
    },
    "signUp": {
      "errorMessage": [],
      "submitButton": [],
      "formStepPath": [],
      "email": [],
      "password": [],
      "verifyPassword": [],
      "endpoint": "",
      "saveStrategy": "",
      "agreementPath": []
    },
    "preApply": {
      "urls": [
        "*://*.breezy.hr/p/*"
      ],
      "entities": [
        [
          "applyButton",
          {
            "actions": [
              {
                "path": [
                  ".//li//a[CONTAINS_TEXT('apply to position', true) or CONTAINS_TEXT('apply now', true)]"
                ],
                "method": "click"
              }
            ]
          },
          {
            "keywords": [
              "apply"
            ]
          }
        ]
      ],
      "continueFilling": true
    },
    "entities": [
      [
        "fullName",
        [
          ".//input[@name='cName']"
        ],
        {
          "keywords": [
            "full name"
          ]
        }
      ],
      [
        "email",
        [
          ".//input[@name='cEmail']"
        ],
        {
          "keywords": [
            "email"
          ]
        }
      ],
      [
        "phoneFormatted",
        [
          ".//input[@name='cPhoneNumber']"
        ],
        {
          "keywords": [
            "phone"
          ]
        }
      ],
      [
        "fullAddress",
        [
          ".//input[@id='fullAddress']"
        ],
        {
          "keywords": [
            "address"
          ]
        }
      ],
      [
        "summary",
        [
          ".//textarea[@name='cSummary']"
        ],
        {
          "keywords": [
            "summary"
          ]
        }
      ],
      [
        "resume",
        {
          "actions": [
            {
              "method": "uploadResume",
              "path": [
                ".//input[@name='cResume']"
              ],
              "options": {
                "waitForNetworkAfterInteraction": true
              }
            }
          ]
        },
        {
          "keywords": [
            "resume"
          ]
        }
      ],
      [
        "experience",
        {
          "addButtonPath": [
            ".//a[CONTAINS_TEXT('add position', true)]"
          ],
          "containerPath": [
            "(//div[@class='section-header'][contains(translate(normalize-space(.//h3), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'work history')]/following-sibling::ul[1]//li)[__indexPlusOne__]"
          ],
          "entities": [
            [
              "title",
              [
                ".//input[@ng-model='candidatePosition.title']"
              ],
              {
                "keywords": [
                  "title"
                ]
              }
            ],
            [
              "companyName",
              [
                ".//input[@ng-model='candidatePosition.company_name']"
              ],
              {
                "keywords": [
                  "company"
                ]
              }
            ],
            [
              "description",
              [
                ".//textarea[@ng-model='candidatePosition.summary']"
              ],
              {
                "keywords": [
                  "description",
                  "summary"
                ]
              }
            ],
            [
              "startDateDashes_YYYYMMDD",
              {
                "actions": [
                  {
                    "method": "setValue",
                    "path": [
                      ".//input[@ng-model='candidatePosition.date_start']"
                    ]
                  }
                ]
              },
              {
                "keywords": [
                  "start date"
                ]
              }
            ],
            [
              "endDateDashes_YYYYMMDD",
              {
                "actions": [
                  {
                    "method": "setValue",
                    "path": [
                      ".//input[@ng-model='candidatePosition.date_end']"
                    ]
                  }
                ]
              },
              {
                "keywords": [
                  "end date"
                ]
              }
            ]
          ]
        },
        {
          "keywords": [
            "experience",
            "work history"
          ]
        }
      ],
      [
        "education",
        {
          "addButtonPath": [
            ".//a[CONTAINS_TEXT('add education', true)]"
          ],
          "containerPath": [
            "(//div[@class='section-header'][contains(translate(normalize-space(.//h3), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'education')]/following-sibling::ul[1]//li)[__indexPlusOne__]"
          ],
          "entities": [
            [
              "name",
              [
                ".//input[@ng-model='candidateSchool.school_name']"
              ],
              {
                "keywords": [
                  "school"
                ]
              }
            ],
            [
              "major",
              [
                ".//input[@ng-model='candidateSchool.field_of_study']"
              ],
              {
                "keywords": [
                  "field of study"
                ]
              }
            ],
            [
              "startDateDashes_YYYYMMDD",
              {
                "actions": [
                  {
                    "method": "setValue",
                    "path": [
                      ".//input[@ng-model='candidateSchool.date_start']"
                    ]
                  }
                ]
              },
              {
                "keywords": [
                  "start date"
                ]
              }
            ],
            [
              "endDateDashes_YYYYMMDD",
              {
                "actions": [
                  {
                    "method": "setValue",
                    "path": [
                      ".//input[@ng-model='candidateSchool.date_end']"
                    ]
                  }
                ]
              },
              {
                "keywords": [
                  "end date"
                ]
              }
            ]
          ]
        },
        {
          "keywords": [
            "education"
          ]
        }
      ],
      [
        "race",
        {
          "actions": [
            {
              "path": [
                ".//li[CONTAINS_TEXT('ethnicity', true)]//ul"
              ],
              "method": "clickOption",
              "values": {
                "Black or African American": [
                  "Black",
                  "African-American"
                ],
                "East Asian": [
                  "Asian"
                ],
                "Hispanic or Latino": [
                  "Hispanic",
                  "Latino"
                ],
                "Southeast Asian": [
                  "Asian"
                ],
                "South Asian": [
                  "Asian"
                ],
                "Native Hawaiian or Other Pacific Islander": [
                  "Native Hawaiian",
                  "Pacific islander"
                ],
                "American Indian or Alaska Native": [
                  "American Indian",
                  "Alaskan Native"
                ],
                "White": [
                  "White"
                ],
                "Two or More Races": [
                  "Two or more races"
                ],
                "Some Other Race": [
                  "I don't wish "
                ],
                "Decline to Answer": [
                  "I don't wish "
                ],
                "": [
                  "I don't wish "
                ]
              },
              "options": {
                "closestCommon": "li",
                "elementToClick": "input[type='radio']"
              }
            }
          ]
        },
        {
          "keywords": [
            "race",
            "ethnicity"
          ]
        }
      ],
      [
        "gender",
        {
          "actions": [
            {
              "path": [
                ".//li[CONTAINS_TEXT('gender', true)]//ul"
              ],
              "method": "clickOption",
              "values": {
                "Male": [
                  "Male"
                ],
                "Female": [
                  "Female"
                ],
                "Other": [
                  "I don't wish to"
                ],
                "Decline to identify": [
                  "I don't wish to"
                ],
                "": [
                  "I don't wish to"
                ]
              },
              "options": {
                "closestCommon": "li",
                "elementToClick": "input[type='radio']"
              }
            }
          ]
        },
        {
          "keywords": [
            "gender"
          ]
        }
      ],
      [
        "veteran",
        {
          "actions": [
            {
              "path": [
                ".//ul[.//input[@name='eeoc.veteran_status'] and CONTAINS_TEXT('veteran', true)]"
              ],
              "method": "clickOption",
              "values": {
                "true": [
                  "I IDENTIFY AS ONE"
                ],
                "false": [
                  "I AM NOT",
                  "Not a veteran"
                ],
                "": [
                  "NOT TO SELF-IDENTIFY"
                ]
              },
              "options": {
                "closestCommon": "li",
                "elementToClick": "input[type='radio']"
              }
            }
          ]
        },
        {
          "keywords": [
            "veteran"
          ]
        }
      ],
      [
        "disability",
        {
          "actions": [
            {
              "path": [
                ".//ul[.//input[@name='eeoc.disability_status'] and CONTAINS_TEXT('disability', true)]"
              ],
              "method": "clickOption",
              "values": {
                "true": [
                  "Yes, I have a "
                ],
                "false": [
                  "No, I do not have"
                ],
                "": [
                  "do not want to answer"
                ]
              },
              "options": {
                "closestCommon": "li",
                "elementToClick": "input[type='radio']"
              }
            }
          ]
        },
        {
          "keywords": [
            "disability"
          ]
        }
      ]
    ],
    "alwaysSyncWindowId": true
  },
  "careerplug": {
    "atsName": "careerplug",
    "urls": [
      "*://*.careerplug.com/jobs/*",
      "*://*.careerplug.com/jobs/*/apps/*",
      "*://*.careerplug.com/apps/*/forms/*",
      "*://*.careerplug.com/jobs/*/apps/new",
      "*://*.careerplug.com/jobs/apps/*/forms"
    ],
    "urlsExclude": [],
    "questionsInSubmitPage": true,
    "submitButtonPaths": [
      ".//input[@type='submit']",
      ".//input[@type='button' and translate(@value, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz') = 'submit']"
    ],
    "nextStepButtonPaths": [],
    "nextStepDynamicLoad": false,
    "formLoadingXPaths": [],
    "validationCheckFormValidity": false,
    "errorBannerXPaths": [],
    "validationErrorXPaths": [],
    "validationErrorPersistent": false,
    "checkErrorsAfterSubmit": true,
    "confirmSubmittedForm": {
      "confirmMessageXPath": [
        ".//div[@class='thank-you-message']",
        ".//div[@class='content' and contains(translate(normalize-space(.), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'thank you')]"
      ],
      "urls": []
    },
    "questionValidationErrorSelectors": [
      ".has-error"
    ],
    "validateUsingQuestionErrorSelectors": true,
    "targetNodeXPath": [
      ".//div[@id='apply-now-form']//form",
      ".//form[@id='new_completed_form']",
      ".//div[@class='thank-you-message']",
      ".//div[@class='content' and contains(translate(normalize-space(.), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'thank you')]"
    ],
    "targetFrameNodeXPath": [],
    "canJobBeAppliedXPaths": {
      "applyButton": [],
      "submitButton": "",
      "email": [],
      "next": []
    },
    "customQuestions": {
      "patterns": {
        "questionId": "",
        "innerSelectors": [],
        "selectInputTagName": "",
        "selectInputAttrName": "",
        "selectInputAttrValue": "",
        "radioGroupMatchQuerySelector": "",
        "fieldsetMatchQuerySelector": ".form-wrapper",
        "maxLabelLevel": "",
        "radioGroupAttrName": "",
        "radioGroupAttrValue": "",
        "listboxTagName": ""
      },
      "selectors": {
        "question": ".form-wrapper",
        "questionParent": ".form-group:not(.hidden):not(.collapse):not(.attach-link):not(#app_referred_input):not(#app_referred_by_input):not(:has(fieldset#employee_referral, #cover_letter, .resume-area))",
        "title": "h1",
        "subTitle": ".header > .job-info",
        "label": "label",
        "legend": "legend",
        "roleOption": "[role='option']",
        "radioInput": "input[type='radio']",
        "monthInput": "input[aria-valuetext='MM'], input[type='month']",
        "dateInput": "input[aria-valuetext='DD']",
        "yearInput": "input[aria-valuetext='YYYY']",
        "checkbox": "input[type='checkbox']",
        "optionsSelector": "label.choice, label.radio-inline"
      },
      "xpaths": {
        "currentListItem": [],
        "listInputBackBtnText": [],
        "selectPopupXPath": [],
        "listBoxPopupXPath": [],
        "selectedItemListXPath": [],
        "requiredFieldXPath": [
          ".//span[@title='required' and text()='*']/parent::label",
          ".//label[contains(@class, 'control-label')]"
        ],
        "targetNodeXPath": []
      },
      "ignoreQuestions": [],
      "ignoreContainerQuestions": []
    },
    "jobXPaths": {
      "entities": [
        [
          "titleDisplay",
          [
            ".//h1[@class='headline']"
          ]
        ],
        [
          "originalCompanyName",
          [
            "//span[contains(@class, 'brand-logo')]/a/img/@alt"
          ]
        ],
        [
          "jobTypes",
          []
        ],
        [
          "postingDate",
          []
        ],
        [
          "url",
          []
        ],
        [
          "desc",
          []
        ],
        [
          "locationDisplay",
          []
        ],
        [
          "location",
          []
        ]
      ]
    },
    "preApply": {
      "urls": [],
      "entities": [
        [
          "consent",
          {}
        ],
        [
          "phoneStrippedCountryCode",
          {}
        ],
        [
          "continueButton",
          {}
        ],
        [
          "chooseVerificationMethod",
          {}
        ],
        [
          "sendButton",
          {}
        ]
      ],
      "urlsExclude": []
    },
    "entities": [
      [
        "answerSource",
        []
      ],
      [
        "applyBtn",
        {}
      ],
      [
        "firstName",
        [
          ".//input[@id='app_applicant_attributes_firstname' or @name='app[applicant_attributes][firstname]']"
        ]
      ],
      [
        "lastName",
        [
          ".//input[@id='app_applicant_attributes_lastname' or @name='app[applicant_attributes][lastname]']"
        ]
      ],
      [
        "preferredFirstName",
        []
      ],
      [
        "legalFirstName",
        []
      ],
      [
        "legalLastName",
        []
      ],
      [
        "fullName",
        []
      ],
      [
        "email",
        [
          ".//input[@id='app_applicant_attributes_email' or @name='app[applicant_attributes][email]']"
        ]
      ],
      [
        "phone",
        [
          ".//input[@id='app_applicant_attributes_phone' or @name='app[applicant_attributes][phone]']"
        ]
      ],
      [
        "agreement",
        {
          "actions": [
            {
              "path": [
                "//input[@type='checkbox' and (@id='app_user_phone_number_attributes_applicant_agrees_sms' or @name='app[user_phone_number_attributes][applicant_agrees_sms]')]"
              ],
              "method": "click"
            }
          ]
        }
      ],
      [
        "addressLine1",
        [
          ".//input[@id='app_applicant_attributes_address' or @name='app[applicant_attributes][address]']"
        ]
      ],
      [
        "city",
        [
          ".//input[@id='app_applicant_attributes_city' or @name='app[applicant_attributes][city]']"
        ]
      ],
      [
        "state",
        []
      ],
      [
        "stateName",
        {
          "actions": [
            {
              "path": [
                ".//select[@id='app_applicant_attributes_state' or @name='app[applicant_attributes][state]']"
              ],
              "method": "clickOption"
            }
          ]
        }
      ],
      [
        "postalCode",
        [
          ".//input[@id='app_applicant_attributes_zip' or @name='app[applicant_attributes][zip]']"
        ]
      ],
      [
        "cityStateName",
        []
      ],
      [
        "country",
        []
      ],
      [
        "resume",
        {
          "actions": [
            {
              "path": [
                ".//input[@id='app_has_attachments_attributes_0_attachment' or @name='app[has_attachments_attributes][0][attachment]']",
                ".//fieldset[contains(@class, 'resume-area')]//input[@type='file' and contains(@accept, '.pdf')]"
              ],
              "method": "uploadResume",
              "options": {
                "processOnErrorPersistent": true
              }
            }
          ]
        }
      ],
      [
        "over18",
        []
      ],
      [
        "minYearlySalaryDesired",
        []
      ],
      [
        "workStartDateAvailabilityString",
        []
      ],
      [
        "recentExperience.companyName",
        [
          ".//input[@id='app_applicant_attributes_recent_employer' or @name='app[applicant_attributes][app_applicant_attributes_recent_employer]']"
        ]
      ],
      [
        "recentExperience.title",
        [
          ".//input[@id='app_applicant_attributes_recent_title' or @name='app[applicant_attributes][recent_title]']"
        ]
      ],
      [
        "experience",
        {
          "addButtonPath": [
            ""
          ],
          "confirmAddedPath": [
            ""
          ],
          "containerPath": [
            ""
          ],
          "entities": [
            [
              "companyName",
              []
            ],
            [
              "city",
              []
            ],
            [
              "state",
              []
            ],
            [
              "title",
              []
            ],
            [
              "cityState",
              []
            ],
            [
              "isCurrent",
              []
            ],
            [
              "startDate",
              []
            ],
            [
              "endDate",
              []
            ],
            [
              "description",
              []
            ]
          ]
        }
      ],
      [
        "weekdaysAvailability",
        {}
      ],
      [
        "weekendsAvailability",
        []
      ],
      [
        "openSchedule",
        {}
      ],
      [
        "flexibleSchedule",
        {}
      ],
      [
        "dayShift",
        {}
      ],
      [
        "nightShift",
        {}
      ],
      [
        "swingShift",
        {}
      ],
      [
        "overnightShift",
        {}
      ],
      [
        "anyShift",
        {}
      ],
      [
        "highestEducationLevel",
        []
      ],
      [
        "education",
        {
          "addButtonPath": [],
          "confirmAddedPath": [],
          "containerPath": [],
          "entities": [
            [
              "name",
              []
            ],
            [
              "degree",
              []
            ],
            [
              "major",
              []
            ],
            [
              "startDateMonth_MM",
              []
            ],
            [
              "endDateMonth_MM",
              []
            ],
            [
              "startDateMonthText",
              []
            ],
            [
              "endDateMonthText",
              []
            ],
            [
              "startDateYear",
              []
            ],
            [
              "endDateYear",
              []
            ],
            [
              "city",
              []
            ],
            [
              "state",
              []
            ]
          ]
        }
      ],
      [
        "workAuth",
        []
      ],
      [
        "agreement",
        {}
      ],
      [
        "sponsorship",
        {}
      ],
      [
        "lift50PoundsWeightAbility",
        {}
      ],
      [
        "gender",
        {
          "actions": [
            {
              "path": [
                ".//select[@id='app_eeoc_gender' or @name='app[eeoc_gender]']"
              ],
              "method": "clickOption",
              "values": {
                "Male": [
                  "Male",
                  "Man"
                ],
                "Female": [
                  "Female",
                  "Woman"
                ],
                "I do not want to answer": [
                  "Decline",
                  "I don't wish",
                  "Prefer not"
                ],
                "": [
                  "Decline",
                  "I don't wish",
                  "Prefer not"
                ]
              }
            }
          ]
        }
      ],
      [
        "hispanicLatino",
        {}
      ],
      [
        "genderPronouns",
        {}
      ],
      [
        "transgender",
        {}
      ],
      [
        "race",
        {
          "actions": [
            {
              "path": [
                ".//select[@id='app_eeoc_race' or @name='app[eeoc_race]']"
              ],
              "method": "clickOption",
              "values": {
                "Black or African American": [
                  "Black",
                  "African"
                ],
                "East Asian": [
                  "East Asian",
                  "Asian"
                ],
                "Hispanic or Latino": "Hispanic",
                "Southeast Asian": [
                  "Southeast Asian",
                  "Asian"
                ],
                "South Asian": [
                  "South Asian",
                  "Asian"
                ],
                "Native Hawaiian or Other Pacific Islander": [
                  "Native Hawaiian",
                  "Pacific Islander"
                ],
                "American Indian or Alaska Native": [
                  "American Indian",
                  "Alaskan Native"
                ],
                "White": "White",
                "Two or More Races": "Two or More",
                "Some Other Race": [
                  "Other",
                  "Decline"
                ],
                "Decline to Answer": [
                  "Decline",
                  "Prefer not"
                ],
                "": [
                  "Decline"
                ]
              }
            }
          ]
        }
      ],
      [
        "veteran",
        {}
      ],
      [
        "disability",
        {}
      ],
      [
        "sexualOrientation",
        {}
      ],
      [
        "linkedin",
        []
      ],
      [
        "github",
        []
      ],
      [
        "twitter",
        []
      ],
      [
        "behance",
        []
      ],
      [
        "countryName",
        []
      ],
      [
        "phoneStripped",
        []
      ],
      [
        "phoneCode",
        []
      ],
      [
        "deviceType",
        {}
      ],
      [
        "certification",
        {
          "addButtonPath": [],
          "confirmAddedPath": [],
          "containerPath": [],
          "entities": [
            [
              "name",
              []
            ],
            [
              "issueDateSlashes_MMDDYYYY",
              []
            ]
          ]
        }
      ],
      [
        "skill",
        {
          "containerPath": [],
          "entities": [
            [
              "name",
              []
            ]
          ],
          "options": {
            "clickOutsideAtEnd": false
          }
        }
      ],
      [
        "lgbt",
        {}
      ],
      [
        "armedForces",
        {}
      ],
      [
        "currentDate.dateString",
        {}
      ],
      [
        "currentDateDashes",
        {}
      ],
      [
        "language",
        {}
      ],
      [
        "privacyAgreement",
        {}
      ],
      [
        "middleName",
        {}
      ],
      [
        "street",
        []
      ],
      [
        "cityLocated",
        []
      ],
      [
        "phoneType",
        {}
      ],
      [
        "phoneFormatted",
        []
      ],
      [
        "homePhoneFormatted",
        []
      ],
      [
        "referral",
        {}
      ],
      [
        "applyDate",
        {}
      ],
      [
        "birthMonth",
        {}
      ],
      [
        "birthDay",
        {}
      ],
      [
        "birthYear",
        {}
      ],
      [
        "addressType",
        {}
      ],
      [
        "startMonthAvailabilityString",
        {}
      ],
      [
        "startDayAvailabilityString",
        {}
      ],
      [
        "startYearAvailabilityString",
        []
      ],
      [
        "county",
        {}
      ],
      [
        "nameInitials",
        []
      ],
      [
        "addressLine2",
        []
      ],
      [
        "highestEducation.name",
        []
      ],
      [
        "highestEducation.degreeDisplay",
        []
      ],
      [
        "workStartDateAvailability",
        []
      ],
      [
        "currencyType",
        {}
      ],
      [
        "willingToWorkHolidays",
        {}
      ],
      [
        "employmentInvoluntarilyTerminated",
        {}
      ],
      [
        "startMonthNameAvailabilityString",
        {}
      ],
      [
        "cityState",
        {}
      ]
    ],
    "globalOptions": {
      "waitForAllRequestsBeforeFillingStep": false
    },
    "signIn": {
      "urls": [],
      "formPath": [],
      "submitButton": [],
      "toSignInButton": [],
      "createAccount": [],
      "forgotPassword": [],
      "email": [],
      "password": [],
      "errorMessage": [],
      "endpoint": "",
      "verifyPassword": [],
      "isInlineForm": false,
      "isEmailRequired": false,
      "errorPersistAfterReload": false
    },
    "signUp": {
      "errorMessage": [],
      "submitButton": [],
      "formStepPath": [],
      "email": [],
      "password": [],
      "verifyPassword": [],
      "endpoint": "",
      "saveStrategy": "",
      "urls": [],
      "verifyEmail": [],
      "userName": []
    },
    "nextStepButtonFallbackToParentFrame": false,
    "attachedContainer": [],
    "alwaysSyncWindowId": false
  },
  "greenhouse": {
    "atsName": "greenhouse",
    "urls": [
      "*://boards.eu.greenhouse.io/*",
      "*://job-boards.eu.greenhouse.io/*",
      "*://job-boards.greenhouse.io/*",
      "*://boards.greenhouse.io/*",
      "*://*/?gh_jid",
      "*://*?gh_jid",
      "*://*/&gh_jid",
      "*://*&gh_jid",
      "*://*?gh_search*"
    ],
    "urlsExclude": [
      "*://boards.greenhouse.io/*/confirmation"
    ],
    "networkOptions": {
      "blacklistedUrlParts": [
        "linkedin",
        "analytics",
        "insights",
        "track"
      ]
    },
    "detectPageQuestions": true,
    "addQuestionLabelId": true,
    "submitButtonPaths": [
      ".//input[@type='submit' and @data-trackingid='job-application-submit']",
      ".//button[@type='submit' and contains(@class, 'submit-step')]",
      ".//input[@type='button' and contains(@id, 'submit')]",
      ".//div[contains(@class, 'application--submit')]//button[@type='submit']",
      ".//button[@type='submit' and contains(@id, 'submit') and CONTAINS_TEXT('apply', true)]",
      ".//form[contains(@action, '/api/greenhouse_jobs')]//input[@type='submit']",
      ".//button[@type='button' and .//span[text()='Submit Application']]"
    ],
    "nextStepButtonPaths": [],
    "validationErrorXPaths": [
      "//div[@class='field-error-msg']",
      "//p[contains(@class, 'helper-text--error')]"
    ],
    "validationCheckFormValidity": true,
    "monitorSubmitFlow": true,
    "waitForSubmitOutcome": true,
    "checkForAlreadyAppliedAfterSubmit": true,
    "errorBannerXPaths": [],
    "questionValidationErrorSelectors": [
      "[aria-invalid='true']",
      "[class*='field-error']"
    ],
    "confirmSubmittedForm": {
      "confirmMessageXPath": [
        ".//div[contains(@id, 'call_to_action') and contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'thank you for applying') and contains(@style, 'display: block')]",
        ".//div[contains(@id, 'application_confirmation')]",
        ".//div[contains(@class, 'confirmation')]//div[contains(@class, 'confirmation__links')]"
      ],
      "confirmMessageSelector": [
        "[id='application_confirmation']"
      ],
      "urls": []
    },
    "verificationAfterSubmit": true,
    "verificationRequired": {
      "errorXPath": [
        "//label[@id='email-verification-label']",
        "//label[@for='security_code']"
      ]
    },
    "verification": {
      "enabled": true,
      "interval": 15000,
      "maxDuration": 120000,
      "codeConfig": [
        {
          "type": "segments",
          "inputs": [
            "//input[contains(@id, 'security-input-')]"
          ]
        },
        {
          "type": "single",
          "inputs": [
            "//input[@id='security_code']"
          ]
        }
      ]
    },
    "targetNodeXPath": [
      ".//form[starts-with(@action, 'https://boards.greenhouse.io/')]",
      ".//form[starts-with(@action, 'https://boards.eu.greenhouse.io/')]",
      ".//form[descendant::input[@type='hidden' and @name='action' and (@value='greenhouse/applications/submit' or @value='gh_application_submission')]]",
      ".//form[@id='application-form']",
      ".//div[@id='js-job-description-entry-point']",
      ".//div[contains(@class, 'gh-single-job')]",
      ".//div[contains(@class, 'job-page-ready-to-apply')]",
      ".//div[contains(@class, '--greenhouse')]",
      ".//form[@id='online-job-app']",
      ".//form[@id='apply-form']"
    ],
    "targetFrameNodeXPath": [
      ".//form[starts-with(@action, 'https://boards.greenhouse.io/embed/')]",
      ".//form[starts-with(@action, 'https://boards.eu.greenhouse.io/embed/')]",
      ".//form[starts-with(@action, 'https://boards.greenhouse.io/')]",
      ".//form[starts-with(@action, 'https://boards.eu.greenhouse.io/')]",
      ".//form[@class='greenhouse-form']//input[@type='hidden' and @name='jobId']",
      ".//form[descendant::input[@type='hidden' and @name='action' and (@value='greenhouse/applications/submit' or @value='gh_application_submission')]]",
      ".//form[@id='application-form']",
      ".//form[@id='apply-form']",
      ".//form[contains(@action, '/api/greenhouse_jobs')]",
      ".//div[contains(@class, 'JobPageApplication__GreenhouseAppContainer')]"
    ],
    "expiredJob": [
      {
        "container": [
          ".//h1",
          ".//h2"
        ],
        "keywords": [
          "current openings at",
          "current job openings",
          "no current openings.",
          "open positions",
          "/^\\d+\\s+Jobs$/i"
        ]
      }
    ],
    "canJobBeAppliedXPaths": {
      "applyButton": [
        ".//a[contains(@class, 'job-description-apply-button')]",
        ".//button[contains(@class, 'applyNowButton')]",
        ".//button[contains(@class, 'apply-button') and contains(@class, 'careers-detail')]",
        "//div[contains(@id, 'greenhouse-apply-link')]//a[contains(@href, 'gh_jid=') and CONTAINS_TEXT('apply', true)]",
        ".//a[@class='apply tab-button']"
      ],
      "submitButton": "submitButtonPaths",
      "options": {
        "checkApplyBtnOutsideIframe": true
      }
    },
    "hiddenElementSelectors": "[class*='-offscreen'], [class*='-display-none']",
    "customQuestions": {
      "patterns": {
        "questionId": "",
        "innerSelectors": [
          "select[name^='job']",
          "select.dropdown[multiple='multiple']",
          "textarea[name^='job']",
          "input[autocomplete^='custom-question']",
          "input[type='checkbox'][name^='job']"
        ],
        "fieldsetMatchQuerySelector": "[data-sja-question-group='checkbox']"
      },
      "selectors": {
        "question": "label[id], label[for]:not(:empty), fieldset, div.field > label, label[class*='required']",
        "title": "h1",
        "label": "label[for='__questionId__'], .field:has(input[id='__questionId__']) label, #custom_fields label, #demographic_questions label, #eeoc_fields label, form[id='application-form'] label, form[id='apply-form'] label, form[id='online-job-app'] label",
        "labelInputGroup": "label:not([for]):not(:has(label))",
        "legend": "#custom_fields legend",
        "ariaLabelledBy": "label",
        "roleOption": "[role='option']",
        "radioInput": "input[type='radio']",
        "monthInput": "input[aria-valuetext='MM']",
        "dateInput": "input[aria-valuetext='DD']",
        "yearInput": "input[aria-valuetext='YYYY']",
        "checkbox": "input[type='checkbox']",
        "mapOption": "[role='option'], option",
        "formGroup": "fieldset.checkbox"
      },
      "xpaths": {
        "currentListItem": [],
        "listInputBackBtnText": [],
        "selectPopupXPath": [
          "//div[contains(@class, 'select__menu-list')]",
          "//div[contains(@class, 'rc-virtual-list-holder-inner')]"
        ],
        "listBoxPopupXPath": [
          "//div[contains(@class, 'select2-drop-active') and @id='select2-drop']//ul"
        ],
        "selectedItemListXPath": [
          "//div[contains(@class, 'select2-drop-active') and @id='select2-drop']//input[contains(@class, 'select2-input')]",
          "//div[@class=' ant-select-item-option-active']"
        ],
        "requiredFieldXPath": [
          ".//span[@class='asterisk']",
          ".//span[CONTAINS_TEXT('*', true)]",
          ".//label[contains(@class, 'ant-form-item-required')]"
        ],
        "requiredTextContent": [
          "required",
          "mandatory",
          "if yes",
          "please enter N/A"
        ]
      },
      "ignoreQuestions": [
        ".//div[contains(@class, 'select__input-container')]//input[contains(@id, 'end-date-month-')]",
        ".//fieldset[@id='resume_fieldset' or @id='cover_letter_fieldset']",
        ".//input[contains(@id, 'security_code') or @id='s2id_autogen2_search' or @id='s2id_autogen89_search']",
        ".//label[contains(@id, 'cover_letter')]",
        ".//label[contains(@id, 'resume')]",
        ".//label[contains(@id, 'start-month-') or contains(@id, 'end-month-')]"
      ],
      "ignoreContainerQuestions": []
    },
    "jobXPaths": {
      "entities": [
        [
          "titleDisplay",
          [
            ".//div[@id='app_body']//h1[@class='app-title']",
            ".//div[@class='section-body' or @class='job__title']/h1",
            ".//div[@class='job__header']//h1[@class='job-title']"
          ]
        ],
        [
          "originalCompanyName",
          [
            "substring(normalize-space(.//div[@id='app_body']//span[@class='company-name']/text()), 4)",
            "substring-after(.//meta[(@property='og:site_name' or @name='application-name') and starts-with(@content, 'Careers at ')]/@content, 'Careers at ')",
            ".//meta[@property='og:site_name' or @name='application-name']/@content"
          ]
        ],
        [
          "jobTypes",
          []
        ],
        [
          "postingDate",
          []
        ],
        [
          "url",
          []
        ],
        [
          "desc",
          [
            ".//div[@id='app_body']//div[@id='content']",
            ".//*[@id='main']//div[@class='page-positions__content']",
            ".//ion-content/main/ng-component/section/article/markdown[descendant::div[@class='content-intro']]"
          ]
        ],
        [
          "locationDisplay",
          [
            ".//div[@id='app_body']//div[@class='location']",
            ".//div[@class='meta']/p[1]",
            ".//span[@class='job-location']"
          ]
        ]
      ]
    },
    "contextData": {
      "classifier": {
        "applyBtnPath": [
          "//a[contains(@href, 'boards.eu.greenhouse.io') and CONTAINS_TEXT('apply', true)]",
          "//a[contains(@href, 'boards.greenhouse.io') and CONTAINS_TEXT('apply', true)]",
          "//a[contains(@href, 'gh_jid=') and CONTAINS_TEXT('apply', true)]",
          "//script[contains(@src, 'boards.greenhouse.io/embed/job_board')]//following::button[contains(@id, 'apply-form-tab') and CONTAINS_TEXT('apply', true)][1]"
        ]
      },
      "options": {}
    },
    "preApply": {
      "urls": [],
      "entities": []
    },
    "entities": [
      [
        "answerSource",
        [
          {
            "actions": [
              {
                "path": [
                  ".//label[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'how') and contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'hear about') and (contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'us') or contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'position') or contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'role'))]//ul[@class='select2-choices']//input",
                  "//div[@class='field'][label[contains(text(), 'How did you hear about this job?')]]//a",
                  "//div[@class='field'][label[contains(text(), 'How did you hear about')]]//div[contains(@class, 'question')]//input"
                ],
                "method": "click",
                "options": {
                  "unmarkFilledStatusIfSomeFails": true
                }
              },
              {
                "path": [
                  "//ul[@id='select2List1' and @role='listbox' and li]",
                  "//ul[contains(@class,'select2-results') and contains(@id,'select2List') and li]",
                  "//fieldset[legend[contains(text(), 'How did you learn about us?')]]"
                ],
                "method": "clickOption",
                "values": {
                  "source": [
                    "Google",
                    "Other"
                  ]
                },
                "options": {
                  "exactXpathSearch": true,
                  "lowPriority": [
                    "Indeed",
                    "ZipRecruiter",
                    "LinkedIn",
                    "Glassdoor",
                    "Simplyhired",
                    "Dice",
                    "CareerBuilder",
                    "Monster"
                  ],
                  "prohibited": [
                    "referral",
                    "referred",
                    "connection",
                    "at the company",
                    "for the organization",
                    "employee",
                    "select",
                    "current worker"
                  ],
                  "ignoreFirst": true,
                  "selectFirstExcludingProhibited": true
                }
              }
            ]
          },
          {
            "actions": [
              {
                "path": [
                  "//input[contains(translate(@aria-label, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'how did you hear about')]",
                  "//input[@autocomplete='custom-question-how-did-you-hear-about-this-job']",
                  "//input[contains(translate(@aria-label, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'selected &quot;other&quot;')]"
                ],
                "method": "setValue",
                "defaultValue": "Job Board"
              }
            ]
          }
        ],
        {
          "keywords": [
            "How did you hear",
            "how-did-you-hear-about-this-job"
          ]
        }
      ],
      [
        "applyBtn",
        {
          "actions": [
            {
              "key": "canJobBeAppliedXPaths.applyButton",
              "method": "click"
            }
          ]
        },
        {
          "keywords": [
            "Apply"
          ]
        }
      ],
      [
        "firstName",
        [
          ".//input[@id='first_name']",
          ".//input[@name='first_name']",
          ".//label[CONTAINS_TEXT('first name')]/parent::*//input[@type='text' and not(ancestor::div[@class='contact-modal_component'])]"
        ],
        {
          "keywords": [
            "First Name"
          ]
        }
      ],
      [
        "lastName",
        [
          ".//input[@id='last_name']",
          ".//input[@name='last_name']",
          ".//label[CONTAINS_TEXT('last name')]/parent::*//input[@type='text' and not(ancestor::div[@class='contact-modal_component'])]"
        ],
        {
          "keywords": [
            "Last Name"
          ]
        }
      ],
      [
        "preferredFirstName",
        [
          ".//input[contains(@autocomplete, 'preferred-first-name')]"
        ],
        {
          "keywords": [
            "Preferred First Name",
            "preferred-first-name"
          ]
        }
      ],
      [
        "legalFirstName",
        [
          ".//input[contains(@autocomplete, 'legal-first-name')]"
        ],
        {
          "keywords": [
            "Legal First Name",
            "legal-first-name"
          ]
        }
      ],
      [
        "legalLastName",
        [
          ".//input[contains(@autocomplete, 'legal-last-name')]"
        ],
        {
          "keywords": [
            "Legal Last Name",
            "legal-last-name"
          ]
        }
      ],
      [
        "fullName",
        [
          ".//input[@id='full_name' or @id='legal_name']",
          ".//input[@name='full_name' or @name='legal_name']",
          ".//label[CONTAINS_TEXT('full name') or CONTAINS_TEXT('legal name')]/parent::*//input[@type='text']"
        ],
        {
          "keywords": [
            "Full Name",
            "Legal Name"
          ]
        }
      ],
      [
        "email",
        [
          ".//div[contains(@class, 'field')]//input[@id='email']",
          ".//div[contains(@class, 'field')]//input[@name='email']",
          ".//div[contains(@class, 'ant-form-item')]//input[@name='email']",
          ".//div[@class='text-input-wrapper']//input[@id='email']",
          ".//div[contains(@class, 'field')]//input[@id='email']",
          "(.//div[contains(@class, 'email')]//input[@autocomplete='email'])[last()]"
        ],
        {
          "keywords": [
            "Email"
          ]
        }
      ],
      [
        "phone",
        [
          ".//div[contains(@class, 'field')]//input[@id='phone']",
          ".//div[contains(@class, 'field')]//input[@name='phone']",
          ".//div[contains(@class, 'ant-form-item')]//input[@name='phone']",
          ".//div[@class='text-input-wrapper']//input[@id='phone']"
        ],
        {
          "keywords": [
            "Phone"
          ]
        }
      ],
      [
        "addressLine1",
        [
          ".//label[CONTAINS_TEXT('address') and not(CONTAINS_TEXT('email'))]/parent::*//input[@type='text' and not(ancestor::div[@class='contact-modal_component'])]",
          ".//input[@autocomplete='custom-question-street-address']"
        ],
        {
          "keywords": [
            "Address",
            "custom-question-street-address"
          ]
        }
      ],
      [
        "recentExperience.companyName",
        [
          ".//input[contains(@autocomplete, 'current-company')]",
          ".//label[(contains(text(), 'current company') or contains(text(), 'current employer')) and not(contains(text(), 'non-compete')) and not(contains(., 'prevents you'))]/parent::div//input[@type='text']",
          ".//label[CONTAINS_TEXT('current') and CONTAINS_TEXT('employer') and not(contains(text(), 'non-compete')) and not(contains(., 'prevents you'))]/parent::div//input[@type='text']"
        ],
        {
          "keywords": [
            "Current Company",
            "Current Employer"
          ]
        }
      ],
      [
        "recentExperience.title",
        [
          ".//input[contains(@autocomplete, 'recent-job-title')]",
          ".//label[CONTAINS_TEXT('current job') or CONTAINS_TEXT('current title')]/parent::div//input[@type='text']",
          ".//label[CONTAINS_TEXT('current') and CONTAINS_TEXT('job title')]/parent::div//input[@type='text']"
        ],
        {
          "keywords": [
            "Current Job Title",
            "Current Title"
          ]
        }
      ],
      [
        "state",
        [
          {
            "actions": [
              {
                "path": [
                  ".//label[CONTAINS_TEXT('state') and not(CONTAINS_TEXT('united')) and not(CONTAINS_TEXT('states'))]/parent::*//div[@class='select2-container']",
                  ".//label[CONTAINS_TEXT('state') and not(CONTAINS_TEXT('united')) and not(CONTAINS_TEXT('states'))]/parent::*//select[not(contains(@style, 'display: none'))]",
                  ".//div[@class='select2-container' and following-sibling::select[@name='job_application[state]']]",
                  ".//select[@name='job_application[state]' and not(contains(@style, 'display: none'))]"
                ],
                "method": "clickOption"
              }
            ]
          },
          {
            "actions": [
              {
                "path": [
                  ".//label[CONTAINS_TEXT('state') and CONTAINS_TEXT('code') and not(CONTAINS_TEXT('states'))]/parent::*//input[@type='text' and not(ancestor::div[@class='contact-modal_component'])]",
                  ".//input[@autocomplete='custom-question-state-code']"
                ],
                "method": "setValue"
              }
            ]
          }
        ],
        {
          "keywords": [
            "State",
            "State Code"
          ]
        }
      ],
      [
        "stateName",
        [
          {
            "actions": [
              {
                "path": [
                  ".//label[CONTAINS_TEXT('state') and not(CONTAINS_TEXT('states'))]/parent::*//select[not(contains(@style, 'display: none'))]"
                ],
                "method": "clickOption",
                "options": {
                  "unmarkFilledStatusIfSomeFails": true
                }
              },
              {
                "path": [
                  ".//label[CONTAINS_TEXT('state') and not(CONTAINS_TEXT('states'))]/parent::*//select[not(contains(@style, 'display: none'))]"
                ],
                "method": "pressEscapeKey"
              }
            ]
          },
          {
            "actions": [
              {
                "path": [
                  ".//label[CONTAINS_TEXT('state') and not(CONTAINS_TEXT('states'))]/parent::*//div[@class='select2-container']"
                ],
                "method": "click",
                "options": {
                  "unmarkFilledStatusIfSomeFails": true
                }
              },
              {
                "path": [
                  "//ul[@class='select2-results' and @id='select2List0']",
                  "//ul[@class='select2-results' and @role='listbox' and child::*]"
                ],
                "method": "clickOption"
              }
            ]
          },
          {
            "actions": [
              {
                "path": [
                  "(.//label[contains(., 'Which state or province do you currently live in?') or contains(., 'Current State of Residence (U.S.)')]//a)[1]"
                ],
                "method": "click",
                "options": {
                  "unmarkFilledStatusIfSomeFails": true
                }
              },
              {
                "path": [
                  "//label[contains(., 'Which state or province do you currently live in?') or contains(., 'Current State of Residence (U.S.)')]//select"
                ],
                "method": "clickOption",
                "options": {
                  "similarMatch": true,
                  "waitForNetworkBeforeInteraction": true,
                  "waitForNetworkAfterInteraction": true
                }
              }
            ]
          }
        ],
        {
          "keywords": [
            "State"
          ]
        }
      ],
      [
        "postalCode",
        [
          ".//label[CONTAINS_TEXT('zip code')]/parent::*//input[@type='text' and not(ancestor::div[@class='contact-modal_component'])]",
          ".//input[@autocomplete='custom-question-zip-code']"
        ],
        {
          "keywords": [
            "Zip Code",
            "custom-question-zip-code"
          ]
        }
      ],
      [
        "cityStateName",
        [
          {
            "actions": [
              {
                "path": [
                  ".//label[CONTAINS_TEXT('city') and not(CONTAINS_TEXT('state'))]/parent::*//input[@type='text' and not(@autocomplete) and not(ancestor::div[@class='contact-modal_component']) and not(ancestor::div[contains(@class, 'select__input-container')]) and not(@id='auto_complete_input')]",
                  ".//input[@autocomplete='custom-question-city' and not(@id='auto_complete_input')]",
                  ".//textarea[@autocomplete='custom-question-city' and not(@id='auto_complete_input')]",
                  ".//input[@id='candidate-location' and not(contains(@style, 'display: none')) and not(ancestor::div[contains(@class, 'select__input-container')])]"
                ],
                "method": "setValue",
                "options": {
                  "triggerBlurEvent": false
                }
              }
            ]
          },
          {
            "actions": [
              {
                "path": [
                  ".//input[@id='candidate-location' and not(contains(@style, 'display: none'))]/ancestor::div[contains(@class, 'select__control')]",
                  ".//input[@id='candidate-location' and not(contains(@style, 'display: none'))]",
                  ".//input[@type='text' and @name='job_application[location]']"
                ],
                "method": "click",
                "options": {
                  "waitForNetworkAfterInteraction": true
                }
              },
              {
                "path": [
                  ".//input[@id='candidate-location' and not(contains(@style, 'display: none'))]"
                ],
                "method": "setValue",
                "options": {
                  "triggerBlurEvent": false,
                  "waitForNetworkBeforeInteraction": true,
                  "waitForNetworkAfterInteraction": true,
                  "triggerKeyDownEvent": true,
                  "triggerKeyUpEvent": true,
                  "trackQuestion": true
                },
                "time": 350
              },
              {
                "path": [
                  ".//div[@id='location_autocomplete_root']//ul[not(@hidden)]",
                  ".//div[@id='candidate-location']//ul",
                  ".//ul[@role='listbox' and contains(@id, 'location')]",
                  ".//div[@role='listbox' and contains(@id, 'location')]"
                ],
                "method": "clickOptionAsync",
                "options": {
                  "waitForNetworkBeforeInteraction": true,
                  "filledVariantIgnoreXPath": [
                    "//span[starts-with(normalize-space(text()), '0 result')]"
                  ],
                  "fallbackToValueFromFields": [
                    "cityStateName",
                    "cityState"
                  ]
                }
              },
              {
                "path": [
                  ".//input[@id='candidate-location' and not(contains(@style, 'display: none'))]/ancestor::div[contains(@class, 'select__control')]",
                  ".//input[@id='candidate-location' and not(contains(@style, 'display: none'))]",
                  ".//input[@type='text' and @name='job_application[location]']"
                ],
                "method": "pressEscapeKey"
              }
            ]
          },
          {
            "actions": [
              {
                "path": [
                  ".//input[contains(@autocomplete, 'from-where-do-you') or contains(@autocomplete, '-location')]"
                ],
                "method": "setValue"
              }
            ]
          },
          {
            "actions": [
              {
                "path": [
                  ".//div[@id='location_autocomplete_root']//input[@type='text']"
                ],
                "method": "click"
              },
              {
                "path": [
                  ".//div[@id='location_autocomplete_root']//input[@type='text']"
                ],
                "method": "setValue",
                "options": {
                  "triggerBlurEvent": false,
                  "waitForNetworkAfterInteraction": true,
                  "triggerKeyDownEvent": true,
                  "triggerKeyUpEvent": true,
                  "trackQuestion": true
                },
                "time": 300
              },
              {
                "path": [
                  ".//div[@id='location_autocomplete_root']//input[@type='text']"
                ],
                "method": "pressEnterKey",
                "options": {
                  "triggerBlurEvent": false,
                  "waitForNetworkAfterInteraction": true
                }
              },
              {
                "path": [
                  ".//div[@id='location_autocomplete_root']//ul[not(@hidden)]"
                ],
                "method": "clickOptionAsync",
                "options": {
                  "similarMatch": true,
                  "waitForNetworkBeforeInteraction": true,
                  "waitForNetworkAfterInteraction": true
                }
              },
              {
                "path": [
                  ".//div[@id='location_autocomplete_root']//input[@type='text']"
                ],
                "method": "pressEscapeKey"
              }
            ]
          }
        ],
        {
          "keywords": [
            "City"
          ]
        }
      ],
      [
        "cityState",
        {
          "actions": [
            {
              "path": [
                ".//label[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'city') and contains(translate(text(), 'CITYANDSTATE', 'cityandstate'), 'state')]/parent::*//input[@type='text' and not(ancestor::div[@class='contact-modal_component']) and not(ancestor::div[contains(@class, 'select__input-container')]) and not(@id='auto_complete_input')]"
              ],
              "method": "setValue"
            }
          ]
        },
        {
          "keywords": [
            "city and state"
          ]
        }
      ],
      [
        "country",
        [
          {
            "actions": [
              {
                "path": [
                  ".//label[CONTAINS_TEXT('country') and not(CONTAINS_TEXT('authoriz')) and not(CONTAINS_TEXT('sponsor'))]/parent::*//div[@class='select2-container']",
                  ".//div[@class='select2-container' and following-sibling::select[@name='job_application[country]']]",
                  ".//label[CONTAINS_TEXT('country') and not(CONTAINS_TEXT('authoriz')) and not(CONTAINS_TEXT('sponsor'))]/parent::*//div[@class='select2-container']",
                  ".//label[CONTAINS_TEXT('country') and not(CONTAINS_TEXT('authoriz')) and not(CONTAINS_TEXT('sponsor'))]/parent::*//select[not(contains(@style, 'display: none')) and not(ancestor::div[@class='contact-modal_component'])]",
                  ".//select[@name='job_application[country]' and not(contains(@style, 'display: none')) and not(ancestor::div[@class='contact-modal_component'])]"
                ],
                "method": "clickOption"
              }
            ]
          },
          {
            "actions": [
              {
                "path": [
                  ".//label[CONTAINS_TEXT('country') and not(CONTAINS_TEXT('authoriz')) and not(CONTAINS_TEXT('sponsor'))]/parent::*//select",
                  ".//label[CONTAINS_TEXT('country') and not(CONTAINS_TEXT('authoriz')) and not(CONTAINS_TEXT('sponsor'))]/parent::*//div[@class='select2-container']",
                  ".//label[CONTAINS_TEXT('country') and not(CONTAINS_TEXT('authoriz')) and not(CONTAINS_TEXT('sponsor'))]/parent::*//select[not(contains(@style, 'display: none'))]"
                ],
                "method": "clickOption"
              }
            ]
          }
        ],
        {
          "keywords": [
            "Country"
          ]
        }
      ],
      [
        "education",
        {
          "addButtonPath": [
            ".//*[@id='add_education']",
            ".//div[@data-name='educations']//a[contains(@class, 'form-multifield__add')]",
            ".//div[contains(@class, 'education--container')]//button[contains(@class, 'add-another-button')]",
            ".//a[contains(@class, 'education-question-add-education')]",
            ".//button[contains(@class, 'add-education')]"
          ],
          "confirmAddedPath": [],
          "containerPath": [
            "(.//div[@id='education_section']//div[@class='education'])[__indexPlusOne__]",
            "(.//div[@data-name='educations']/ul/li)[__indexPlusOne__]",
            "(.//div[contains(@class, 'education--container')]//div[contains(@class, 'education--form')])[__indexPlusOne__]",
            "(.//div[contains(@class, 'education-question-group')])[__indexPlusOne__]",
            "(.//div[@class='job-education-fields'])[__indexPlusOne__]"
          ],
          "options": {
            "getRelevantEntities": true
          },
          "entities": [
            [
              "name",
              [
                {
                  "actions": [
                    {
                      "path": [
                        ".//label[contains(@id, 'school')]/following-sibling::div//div[contains(@class, 'select__control')]//input",
                        "//a[.//span[@class='select2-chosen' and normalize-space()='Select a School']]"
                      ],
                      "method": "click",
                      "time": 250,
                      "options": {
                        "unmarkFilledStatusIfSomeFails": true,
                        "trackQuestion": true
                      }
                    },
                    {
                      "path": [
                        "//div[contains(@class, 'select2-drop-active') and @id='select2-drop']//input[contains(@class, 'select2-input')]",
                        ".//label[contains(@id, 'school')]/following-sibling::div//input[contains(@class, 'select__input')]",
                        "(//input[@role='combobox' and @id = //label[contains(normalize-space(), 'School')]/@for])[__indexPlusOne__]"
                      ],
                      "method": "setValue",
                      "options": {
                        "triggerBlurEvent": false,
                        "triggerKeyDownEvent": true,
                        "triggerKeyUpEvent": true,
                        "triggerInputEvent": true,
                        "triggerKeyPressEvent": true,
                        "waitForNetworkAfterInteraction": true,
                        "resetValue": true,
                        "checkAcronym": true
                      },
                      "time": 500
                    },
                    {
                      "path": [
                        "//div[contains(@class, 'select2-drop-active') and @id='select2-drop']//ul[count(li) > 0]",
                        ".//div[contains(@class, 'select__menu-list') and @role='listbox']",
                        "//div[contains(@class, 'select__menu-list') and @role='listbox']",
                        ".//div[contains(@class, 'selectize-dropdown') and contains(@class, 'single')]//div[contains(@class, 'content')]",
                        "(//div[contains(@class, 'select2-drop-active') and @id='select2-drop']//ul)[last()]",
                        "//select[contains(@name, '[__index__][school_name_id]')]",
                        ".//ul[@class='select2-results' and @role='listbox' and ./li]"
                      ],
                      "method": "clickOption",
                      "options": {
                        "waitForNetworkBeforeInteraction": true,
                        "waitForNetworkAfterInteraction": true,
                        "useNetworkQuietPeriod": true,
                        "dropdownPersistent": true,
                        "clickTrackedQuestion": true,
                        "autocomplete": true,
                        "checkAcronym": true,
                        "similarExceptXPaths": [
                          ".//li[contains(@class,'select2-result') and contains(translate(string(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'other') and not(normalize-space(translate(string(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'))='other') and not(contains(translate(string(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'not listed')) and not(contains(translate(string(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'0'))]//*"
                        ],
                        "fallbackOptionsArray": [
                          "Other",
                          "Not Listed",
                          "Other - Not Listed"
                        ]
                      }
                    }
                  ]
                },
                {
                  "actions": [
                    {
                      "path": [
                        ".//div[contains(@class, 'school')]//input[@type='select-one']"
                      ],
                      "method": "click",
                      "options": {
                        "unmarkFilledStatusIfSomeFails": true
                      }
                    },
                    {
                      "path": [
                        ".//div[contains(@class, 'school')]//input[@type='select-one']"
                      ],
                      "method": "setValue",
                      "options": {
                        "triggerKeyDownEvent": true,
                        "triggerBlurEvent": false,
                        "waitForNetworkAfterInteraction": true
                      }
                    },
                    {
                      "path": [
                        ".//div[contains(@class, 'school')]//input[@type='select-one']"
                      ],
                      "method": "pressEnterKey"
                    },
                    {
                      "path": [
                        "(.//div[contains(@class, 'selectize-dropdown') and contains(@class, 'single')]//div[contains(@class, 'content')])[__indexPlusOne__]"
                      ],
                      "method": "clickOptionAsync",
                      "options": {
                        "similarMatch": true,
                        "waitForNetworkBeforeInteraction": true
                      }
                    },
                    {
                      "path": [
                        ".//div[contains(@class, 'school')]//input[@type='select-one']"
                      ],
                      "method": "pressEscapeKey",
                      "options": {
                        "waitForNetworkBeforeInteraction": true
                      }
                    }
                  ]
                }
              ],
              {
                "keywords": [
                  "School"
                ]
              }
            ],
            [
              "degree",
              {
                "actions": [
                  {
                    "path": [
                      ".//div[@id='s2id_education_degree___index__']//a",
                      ".//label[contains(@id, 'degree')]/following-sibling::div//div[contains(@class, 'select__control')]//input"
                    ],
                    "method": "click",
                    "options": {
                      "waitForNetworkBeforeInteraction": true,
                      "waitForNetworkAfterInteraction": true,
                      "trackQuestion": true,
                      "preventClickIfEmpty": true
                    },
                    "time": 250
                  },
                  {
                    "path": [
                      "//div[contains(@class, 'select2-drop-active') and @id='select2-drop']//input[contains(@class, 'select2-input')]"
                    ],
                    "method": "setValue",
                    "options": {
                      "waitForNetworkBeforeInteraction": true,
                      "waitForNetworkAfterInteraction": true
                    },
                    "time": 250
                  },
                  {
                    "path": [
                      "//div[contains(@class, 'select2-drop-active') and @id='select2-drop']//ul",
                      ".//div[contains(@class, 'select__menu-list') and @role='listbox']",
                      ".//ul[@class='select2-results' and @role='listbox' and count(li) > 0]",
                      "//select[contains(@name, '[__index__][degree_id]')]",
                      ".//select[@id='education_degree___index__']"
                    ],
                    "method": "clickOption",
                    "options": {
                      "waitForNetworkBeforeInteraction": true,
                      "dropdownPersistent": true
                    },
                    "values": {
                      "bachelor's": [
                        "Bachelor's Degree",
                        "Bachelors"
                      ],
                      "master's": [
                        "Master's Degree",
                        "Master of Science",
                        "Masters"
                      ],
                      "associate's": [
                        "Associate's Degree"
                      ]
                    }
                  },
                  {
                    "path": [
                      ".//div[@id='s2id_education_degree___index__']//a",
                      ".//label[contains(@id, 'degree')]/following-sibling::div//div[contains(@class, 'select__control')]"
                    ],
                    "method": "pressEscapeKey",
                    "options": {
                      "waitForNetworkBeforeInteraction": true
                    }
                  }
                ]
              },
              {
                "keywords": [
                  "School",
                  "Degree"
                ]
              }
            ],
            [
              "major",
              {
                "actions": [
                  {
                    "path": [
                      ".//div[@id='s2id_education_discipline___index__']//a",
                      ".//label[contains(@id, 'discipline')]/following-sibling::div//div[contains(@class, 'select__control')]"
                    ],
                    "method": "click",
                    "options": {
                      "waitForNetworkBeforeInteraction": true,
                      "waitForNetworkAfterInteraction": true,
                      "unmarkFilledStatusIfSomeFails": true
                    },
                    "time": 250
                  },
                  {
                    "path": [
                      "//div[contains(@class, 'select2-drop-active') and @id='select2-drop']//input[contains(@class, 'select2-input')]",
                      ".//label[contains(@id, 'discipline')]/following-sibling::div//input[contains(@class, 'select__input')]"
                    ],
                    "method": "setValue",
                    "options": {
                      "trackQuestion": true,
                      "resetValue": true,
                      "triggerKeyDownEvent": true,
                      "triggerInputEvent": true,
                      "triggerKeyUpEvent": true,
                      "triggerChangeEvent": true,
                      "triggerFocusInEvent": true,
                      "triggerKeyPressEvent": true,
                      "ignoreExistingValue": true
                    },
                    "time": 500
                  },
                  {
                    "path": [
                      "//div[contains(@class, 'select2-drop-active') and @id='select2-drop']//ul",
                      ".//div[contains(@class, 'select__menu-list') and @role='listbox']",
                      "//div[contains(@class, 'select__menu-list') and @role='listbox']",
                      "//select[@id='education_discipline___index__' and contains(@class, 'discipline')]",
                      "//select[contains(@name, '[__index__][discipline_id]')]"
                    ],
                    "method": "clickOption",
                    "options": {
                      "autocomplete": true
                    }
                  }
                ]
              },
              {
                "keywords": [
                  "Major",
                  "Discipline"
                ]
              }
            ],
            [
              "startDateMonth_MM",
              [
                ".//input[@name='job_application[educations][][start_date][month]']",
                ".//input[contains(@name, '[__index__][start_date][month]')]"
              ],
              {
                "keywords": [
                  "Start Date"
                ]
              }
            ],
            [
              "endDateMonth_MM",
              {
                "actions": [
                  {
                    "path": [
                      ".//input[@name='job_application[educations][][end_date][month]']",
                      ".//input[contains(@id, 'end_month') and contains(@id, 'question')]",
                      ".//input[contains(@name, '[__index__][end_date][month]')]"
                    ],
                    "method": "setValue",
                    "options": {
                      "useTodayAsFallback": true
                    }
                  }
                ]
              },
              {
                "keywords": [
                  "End Date"
                ]
              }
            ],
            [
              "startDateMonthText",
              [
                {
                  "actions": [
                    {
                      "path": [
                        ".//select[@name='educations[][start_date][month]' and not(contains(@style, 'display: none'))]"
                      ],
                      "method": "clickOption"
                    }
                  ]
                },
                {
                  "actions": [
                    {
                      "path": [
                        ".//label[contains(@id, 'start-month')]/following-sibling::div//div[contains(@class, 'select__control')]"
                      ],
                      "method": "click"
                    },
                    {
                      "path": [
                        ".//div[contains(@class, 'select__menu-list') and @role='listbox']",
                        "//div[contains(@class, 'select__menu-list') and @role='listbox']"
                      ],
                      "method": "clickOption"
                    }
                  ]
                }
              ],
              {
                "keywords": [
                  "Start Date"
                ]
              }
            ],
            [
              "endDateMonthText",
              [
                {
                  "actions": [
                    {
                      "path": [
                        ".//select[@name='educations[][end_date][month]' and not(contains(@style, 'display: none'))]"
                      ],
                      "method": "clickOption",
                      "options": {
                        "useTodayAsFallback": true
                      }
                    }
                  ]
                },
                {
                  "actions": [
                    {
                      "path": [
                        ".//label[contains(@id, 'end-month')]/following-sibling::div//div[contains(@class, 'select__control')]"
                      ],
                      "method": "click"
                    },
                    {
                      "path": [
                        ".//div[contains(@class, 'select__menu-list') and @role='listbox']",
                        "//div[contains(@class, 'select__menu-list') and @role='listbox']"
                      ],
                      "method": "clickOption",
                      "options": {
                        "useTodayAsFallback": true
                      }
                    }
                  ]
                }
              ],
              {
                "keywords": [
                  "End Date"
                ]
              }
            ],
            [
              "startDateYear",
              [
                ".//input[@name='job_application[educations][][start_date][year]']",
                ".//label[contains(@id, 'start-year')]/following-sibling::input[contains(@id, 'start-year')]",
                ".//input[contains(@name, '[__index__][start_date][year]')]"
              ],
              {
                "keywords": [
                  "Start Date"
                ]
              }
            ],
            [
              "endDateYear",
              {
                "actions": [
                  {
                    "path": [
                      ".//input[@name='job_application[educations][][end_date][year]']",
                      ".//label[contains(@id, 'end-year')]/following-sibling::input[contains(@id, 'end-year')]",
                      ".//input[contains(@id, 'end_year') and contains(@id, 'question')]",
                      ".//input[contains(@name, '[__index__][end_date][year]')]"
                    ],
                    "method": "setValue",
                    "options": {
                      "useTodayAsFallback": true
                    }
                  }
                ]
              },
              {
                "keywords": [
                  "End Date"
                ]
              }
            ]
          ]
        },
        {
          "keywords": [
            "School",
            "Degree"
          ]
        }
      ],
      [
        "experience",
        {
          "addButtonPath": [
            ".//div[contains(@class, 'employment--container')]//button[contains(@class, 'add-another-button')]",
            ".//a[contains(@id, 'add_employment')]"
          ],
          "confirmAddedPath": [
            "(.//div[contains(@class, 'employment--container')]//div[contains(@class, 'employment-form')])[__indexPlusOne__]"
          ],
          "containerPath": [
            "(.//div[contains(@class, 'employment--container')]//div[contains(@class, 'employment-form')])[__indexPlusOne__]",
            "//div[@class='employment'][.//input[@id='employment_company_name___indexString__']]"
          ],
          "entities": [
            [
              "companyName",
              [
                ".//input[@id='company-name-__index__']",
                "//input[@id='employment_company_name___index__']"
              ]
            ],
            [
              "title",
              [
                ".//input[@id='title-__index__']",
                ".//input[@id='employment_title___index__']"
              ]
            ],
            [
              "cityState",
              []
            ],
            [
              "startDateMonthText",
              {
                "actions": [
                  {
                    "path": [
                      ".//input[@id='start-date-month-__index__' and not(ancestor::div[contains(@class, 'select__control--is-disabled')])]"
                    ],
                    "method": "click",
                    "options": {
                      "unmarkFilledStatusIfSomeFails": true
                    }
                  },
                  {
                    "path": [
                      ".//div[@id='react-select-start-date-month-__index__-listbox']"
                    ],
                    "method": "clickOption",
                    "values": {
                      "January": [
                        "Jan",
                        "January",
                        "01",
                        "1"
                      ],
                      "February": [
                        "Feb",
                        "February",
                        "02"
                      ],
                      "March": [
                        "Mar",
                        "March",
                        "03"
                      ],
                      "April": [
                        "Apr",
                        "April",
                        "04"
                      ],
                      "May": [
                        "May",
                        "05"
                      ],
                      "June": [
                        "Jun",
                        "June",
                        "06"
                      ],
                      "July": [
                        "Jul",
                        "July",
                        "07"
                      ],
                      "August": [
                        "Aug",
                        "August",
                        "08"
                      ],
                      "September": [
                        "Sep",
                        "September",
                        "09"
                      ],
                      "October": [
                        "Oct",
                        "October",
                        "10"
                      ],
                      "November": [
                        "Nov",
                        "November",
                        "11"
                      ],
                      "December": [
                        "Dec",
                        "December",
                        "12"
                      ]
                    }
                  }
                ]
              }
            ],
            [
              "startDateMonth_MM",
              [
                ".//input[contains(@class, 'start-date-month')]"
              ]
            ],
            [
              "startDateYear",
              [
                ".//input[@id='start-date-year-__index__']",
                ".//input[@aria-label='Employment Start Year']"
              ]
            ],
            [
              "isCurrent",
              {
                "actions": [
                  {
                    "path": [
                      ".//label[contains(@for, 'current-role-__index__')]",
                      ".//input[contains(@id, 'employment_current___index__')]"
                    ],
                    "method": "click"
                  }
                ]
              }
            ],
            [
              "endDateMonth_MM",
              [
                ".//input[contains(@class, 'end-date-month')]"
              ]
            ],
            [
              "endDateMonthText",
              {
                "actions": [
                  {
                    "path": [
                      ".//input[@id='end-date-month-__index__' and not(ancestor::div[contains(@class, 'select__control--is-disabled')])]"
                    ],
                    "method": "click",
                    "options": {
                      "unmarkFilledStatusIfSomeFails": true
                    }
                  },
                  {
                    "path": [
                      ".//div[@id='react-select-end-date-month-__index__-listbox']"
                    ],
                    "method": "clickOption",
                    "values": {
                      "January": [
                        "Jan",
                        "January",
                        "01",
                        "1"
                      ],
                      "February": [
                        "Feb",
                        "February",
                        "02"
                      ],
                      "March": [
                        "Mar",
                        "March",
                        "03"
                      ],
                      "April": [
                        "Apr",
                        "April",
                        "04"
                      ],
                      "May": [
                        "May",
                        "05"
                      ],
                      "June": [
                        "Jun",
                        "June",
                        "06"
                      ],
                      "July": [
                        "Jul",
                        "July",
                        "07"
                      ],
                      "August": [
                        "Aug",
                        "August",
                        "08"
                      ],
                      "September": [
                        "Sep",
                        "September",
                        "09"
                      ],
                      "October": [
                        "Oct",
                        "October",
                        "10"
                      ],
                      "November": [
                        "Nov",
                        "November",
                        "11"
                      ],
                      "December": [
                        "Dec",
                        "December",
                        "12"
                      ]
                    }
                  }
                ]
              }
            ],
            [
              "endDateYear",
              [
                ".//input[@id='end-date-year-__index__']",
                ".//input[@aria-label='Employment End Year']"
              ]
            ],
            [
              "description",
              []
            ]
          ]
        },
        {
          "keywords": [
            "Company",
            "Title"
          ]
        }
      ],
      [
        "over18",
        {
          "actions": [
            {
              "path": [
                ".//label[(CONTAINS_TEXT('over') and CONTAINS_TEXT('18')) or CONTAINS_TEXT('18 years')]/parent::*//select",
                ".//label[(CONTAINS_TEXT('over') and CONTAINS_TEXT('18')) or CONTAINS_TEXT('18 years')]/parent::*//div[@class='select2-container']",
                ".//label[(CONTAINS_TEXT('over') and CONTAINS_TEXT('18')) or CONTAINS_TEXT('18 years')]/parent::*//select[not(contains(@style, 'display: none'))]"
              ],
              "method": "clickOption",
              "values": {
                "true": [
                  "Yes"
                ],
                "false": [
                  "No"
                ]
              }
            }
          ]
        },
        {
          "keywords": [
            "Over 18",
            "at least 18 years"
          ]
        }
      ],
      [
        "jobTypes",
        {
          "actions": [
            {
              "path": [
                ".//div[@class='field'][label[CONTAINS_TEXT('employment') and CONTAINS_TEXT('type') or CONTAINS_TEXT('job') and CONTAINS_TEXT('type')]]"
              ],
              "method": "clickMultipleCheckboxes",
              "options": {
                "checkboxSelector": "input[type='checkbox']",
                "checkboxLabelSelector": "label"
              }
            }
          ]
        }
      ],
      [
        "weekdaysAvailability",
        {
          "actions": [
            {
              "path": [
                ".//label[contains(text(), 'Select all days you are available to work')]"
              ],
              "method": "clickOption",
              "values": {
                "true": [
                  "Weekdays (Monday-Friday)",
                  "Weekdays",
                  "Monday-Friday"
                ],
                "false": [
                  ""
                ]
              }
            }
          ]
        },
        {
          "keywords": [
            "Select all days you are available to work"
          ]
        }
      ],
      [
        "weekendsAvailability",
        {
          "actions": [
            {
              "path": [
                ".//label[contains(text(), 'Select all days you are available to work') or contains(text(), 'What shift(s) are you willing to work?')]"
              ],
              "method": "clickOption",
              "values": {
                "true": [
                  "Weekends (Saturday - Sunday)",
                  "Weekends",
                  "Saturday - Sunday"
                ],
                "false": [
                  ""
                ]
              }
            }
          ]
        },
        {
          "keywords": [
            "Select all days you are available to work"
          ]
        }
      ],
      [
        "openSchedule",
        {
          "actions": [
            {
              "path": [
                ".//label[contains(text(), 'Select all days you are available to work') or contains(text(), 'What shift(s) are you willing to work?')]"
              ],
              "method": "clickOption",
              "values": {
                "true": [
                  "Open Schedule (Monday - Sunday)"
                ],
                "false": [
                  ""
                ]
              }
            }
          ]
        },
        {
          "keywords": [
            "Select all days you are available to work"
          ]
        }
      ],
      [
        "flexibleSchedule",
        {
          "actions": [
            {
              "path": [
                ".//label[contains(text(), 'Select all days you are available to work')]"
              ],
              "method": "clickOption",
              "values": {
                "true": [
                  "Flexible schedule needed"
                ],
                "false": [
                  ""
                ]
              }
            }
          ]
        },
        {
          "keywords": [
            "Select all days you are available to work"
          ]
        }
      ],
      [
        "dayShift",
        {
          "actions": [
            {
              "path": [
                ".//label[contains(text(), 'Select all shifts you are available to work') or contains(text(), 'What shift(s) are you willing to work?')]"
              ],
              "method": "clickOption",
              "values": {
                "true": [
                  "Day Shift",
                  "1st Shift"
                ],
                "false": [
                  ""
                ]
              }
            }
          ]
        },
        {
          "keywords": [
            "Select all shifts you are available to work"
          ]
        }
      ],
      [
        "nightShift",
        {
          "actions": [
            {
              "path": [
                ".//label[contains(text(), 'Select all shifts you are available to work') or contains(text(), 'What shift(s) are you willing to work?')]"
              ],
              "method": "clickOption",
              "values": {
                "true": [
                  "Night Shift",
                  "3rd Shift"
                ],
                "false": [
                  ""
                ]
              }
            }
          ]
        },
        {
          "keywords": [
            "Select all shifts you are available to work"
          ]
        }
      ],
      [
        "swingShift",
        {
          "actions": [
            {
              "path": [
                ".//label[contains(text(), 'Select all shifts you are available to work') or contains(text(), 'What shift(s) are you willing to work?')]"
              ],
              "method": "clickOption",
              "values": {
                "true": [
                  "Swing Shift",
                  "2nd Shift"
                ],
                "false": [
                  ""
                ]
              }
            }
          ]
        },
        {
          "keywords": [
            "Select all shifts you are available to work"
          ]
        }
      ],
      [
        "overnightShift",
        {
          "actions": [
            {
              "path": [
                ".//label[contains(text(), 'Select all shifts you are available to work') or contains(text(), 'What shift(s) are you willing to work?')]"
              ],
              "method": "clickOption",
              "values": {
                "true": [
                  "Overnight Shift"
                ],
                "false": [
                  ""
                ]
              }
            }
          ]
        },
        {
          "keywords": [
            "Select all shifts you are available to work"
          ]
        }
      ],
      [
        "anyShift",
        {
          "actions": [
            {
              "path": [
                ".//label[contains(text(), 'Select all shifts you are available to work') or contains(text(), 'What shift(s) are you willing to work?')]"
              ],
              "method": "clickOption",
              "values": {
                "true": [
                  "Open to All",
                  "All Shifts",
                  "All"
                ],
                "false": [
                  ""
                ]
              }
            }
          ]
        },
        {
          "keywords": [
            "Select all shifts you are available to work"
          ]
        }
      ],
      [
        "workAuth",
        [
          {
            "actions": [
              {
                "path": [
                  ".//label[CONTAINS_TEXT('right to work in') or CONTAINS_TEXT('authorized to work') or CONTAINS_TEXT('eligible to be employed')]/parent::*//select",
                  ".//label[CONTAINS_TEXT('authorized to work') and not(CONTAINS_TEXT('sponsor'))]/parent::*//div[@class='select2-container']",
                  ".//label[CONTAINS_TEXT('right to work in')]/parent::*//div[@class='select2-container']",
                  ".//label[CONTAINS_TEXT('authorized to work') and not(CONTAINS_TEXT('sponsor'))]/parent::*//select[not(contains(@style, 'display: none'))]",
                  ".//label[CONTAINS_TEXT('right to work in')]/parent::*//select[not(contains(@style, 'display: none'))]",
                  "//div[@class='field'][label[contains(text(), 'authorized to work')]]//select"
                ],
                "method": "clickOption",
                "values": {
                  "true": [
                    "Yes"
                  ],
                  "false": [
                    "No"
                  ]
                }
              }
            ]
          },
          {
            "actions": [
              {
                "path": [
                  ".//label[CONTAINS_TEXT('authorized to work') and not(CONTAINS_TEXT('sponsor'))]/parent::*//div[contains(@class, 'select__control')]",
                  "//div[@class='field'][label[contains(text(), 'authorized to work in')]]//a",
                  "//div[@class='field'][label[contains(text(), 'eligible to work')]]//a"
                ],
                "method": "click",
                "options": {
                  "unmarkFilledStatusIfSomeFails": true
                }
              },
              {
                "path": [
                  ".//label[CONTAINS_TEXT('authorized to work') and not(CONTAINS_TEXT('sponsor'))]/parent::*//div[contains(@class, 'select__menu')]",
                  "//ul[@class='select2-results' and @id='select2List0']",
                  "//ul[@class='select2-results' and @role='listbox' and child::*]",
                  "//div[@class='field'][label[contains(text(), 'authorized to work in')]]//select"
                ],
                "method": "clickOption",
                "values": {
                  "true": [
                    "Yes"
                  ],
                  "false": [
                    "No"
                  ]
                }
              }
            ]
          }
        ],
        {
          "keywords": [
            "authorized to work",
            "eligible to work"
          ]
        }
      ],
      [
        "sponsorship",
        [
          {
            "actions": [
              {
                "path": [
                  ".//label[CONTAINS_TEXT('sponsor') and not(CONTAINS_TEXT('authorized')) and not(CONTAINS_TEXT('eligible to work'))]/parent::*//select",
                  ".//label[(CONTAINS_TEXT('sponsor') or CONTAINS_TEXT('in the future require sponsorship') or CONTAINS_TEXT('will you require sponsorship') or CONTAINS_TEXT('do you require sponsorship')) and not(CONTAINS_TEXT('authoriz')) and not(CONTAINS_TEXT('eligible to work'))]/parent::*//div[@class='select2-container']",
                  ".//label[CONTAINS_TEXT('sponsorship for work auth') and not(CONTAINS_TEXT('eligible to work'))]/parent::*//div[@class='select2-container']",
                  ".//div[@class='select2-container' and following-sibling::select[@name='job_application[sponsorship]']]",
                  ".//label[CONTAINS_TEXT('sponsor') and not(CONTAINS_TEXT('authorized')) and not(CONTAINS_TEXT('eligible to work'))]/parent::*//select[not(contains(@style, 'display: none'))]",
                  ".//label[CONTAINS_TEXT('sponsorship for work auth') and not(CONTAINS_TEXT('eligible to work'))]/parent::*//select[not(contains(@style, 'display: none'))]",
                  ".//select[@name='job_application[sponsorship]' and not(contains(@style, 'display: none'))]",
                  "//div[@class='field'][.//label[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'visa') or contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'sponsorship')]]//select"
                ],
                "method": "clickOption",
                "values": {
                  "true": [
                    "Yes"
                  ],
                  "false": [
                    "No"
                  ]
                }
              }
            ]
          },
          {
            "actions": [
              {
                "path": [
                  ".//label[CONTAINS_TEXT('sponsor') and not(CONTAINS_TEXT('authorized'))]//div[@class='select2-container']//a",
                  "//label[contains(text(), 'sponsorship for work auth') or contains(text(), 'require visa sponsorship')]//select"
                ],
                "method": "click",
                "options": {
                  "unmarkFilledStatusIfSomeFails": true
                }
              },
              {
                "path": [
                  "//ul[@class='select2-results' and child::*]",
                  "//div[@class='field'][label[contains(text(), 'sponsorship for work auth') or contains(text(), 'require visa sponsorship')]]//select"
                ],
                "method": "clickOption",
                "values": {
                  "true": [
                    "Yes"
                  ],
                  "false": [
                    "No"
                  ]
                }
              }
            ]
          }
        ],
        {
          "keywords": [
            "Visa sponsorship",
            "sponsorship for",
            "need sponsorship"
          ]
        }
      ],
      [
        "lift50PoundsWeightAbility",
        {
          "actions": [
            {
              "path": [
                ".//label[CONTAINS_TEXT('to lift at least')]/parent::*//div[@class='select2-container']",
                ".//label[CONTAINS_TEXT('to lift at least')]/parent::*//select[not(contains(@style, 'display: none'))]"
              ],
              "method": "clickOption",
              "values": {
                "true": [
                  "Yes"
                ],
                "false": [
                  "No"
                ]
              }
            }
          ]
        },
        {
          "keywords": [
            "to lift at least"
          ]
        }
      ],
      [
        "resume",
        [
          {
            "actions": [
              {
                "path": [
                  "//div[@required='required' and @data-allow-s3='false']//button[@aria-describedby='resume-allowable-file-types']"
                ],
                "method": "click"
              },
              {
                "path": [
                  "//input[@type='file' and @id='resume_file']"
                ],
                "method": "uploadResume"
              }
            ]
          },
          {
            "actions": [
              {
                "path": [
                  "//form[@id='s3_upload_for_resume']//input[@type='file']",
                  "//input[@type='file' and @id='resume']",
                  "//input[@type='file' and @name='resume']",
                  "//input[@type='file' and @id = //label[CONTAINS_TEXT('resume', true)]/@for]",
                  "//input[@type='file' and @data-testid='resume-text']",
                  "//span[@class='ant-upload']//input[@type='file']"
                ],
                "method": "uploadResume"
              }
            ]
          }
        ],
        {
          "keywords": [
            "Resume",
            "Resume/CV"
          ]
        }
      ],
      [
        "agreement",
        [
          {
            "actions": [
              {
                "path": [
                  ".//input[@type='checkbox' and (contains(translate(@description, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'privacy notice') or contains(translate(@description, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'privacy policy'))]"
                ],
                "method": "clickCheckbox"
              }
            ]
          },
          {
            "actions": [
              {
                "path": [
                  ".//label[CONTAINS_TEXT('applicant statement') or CONTAINS_TEXT('i certify') or CONTAINS_TEXT('privacy acknowledgement')]/parent::*//select",
                  ".//label[CONTAINS_TEXT('applicant statement') or CONTAINS_TEXT('i certify') or CONTAINS_TEXT('privacy acknowledgement')]/parent::*//div[@class='select2-container']",
                  ".//label[CONTAINS_TEXT('finalize') and CONTAINS_TEXT('application') and CONTAINS_TEXT('yes')]/parent::*//select"
                ],
                "method": "clickOption",
                "values": {
                  "true": [
                    "Yes"
                  ],
                  "false": [
                    "No"
                  ]
                }
              }
            ]
          },
          {
            "actions": [
              {
                "path": [
                  ".//label[CONTAINS_TEXT('privacy statement')]/parent::*//div[@class='select2-container']",
                  ".//label[CONTAINS_TEXT('privacy statement')]/parent::*//select[not(contains(@style, 'display: none'))]"
                ],
                "method": "clickOption",
                "values": {
                  "true": [
                    "I acknowledge"
                  ],
                  "false": [
                    "No"
                  ]
                }
              }
            ]
          },
          {
            "actions": [
              {
                "path": [
                  ".//input[@type='checkbox' and contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'consent') and @required]"
                ],
                "method": "clickMultipleCheckboxes",
                "options": {
                  "check": true
                }
              }
            ]
          }
        ],
        {
          "keywords": [
            "Agreement",
            "Privacy",
            "I consent to",
            "I agree to",
            "has my consent",
            "finalize your application"
          ]
        }
      ],
      [
        "genderPronouns",
        {
          "actions": [
            {
              "path": [
                ".//label[CONTAINS_TEXT('pronoun')]/parent::*//select",
                ".//label[CONTAINS_TEXT('pronoun')]/parent::*//div[@class='select2-container']",
                ".//label[CONTAINS_TEXT('pronoun')]/parent::*//select[not(contains(@style, 'display: none'))]",
                ".//div[contains(@class, 'field') and contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'pronoun')]",
                "//fieldset[@class='checkbox' and legend[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'what are your pronouns')]]"
              ],
              "method": "clickOption",
              "values": {
                "He/him/his": [
                  "he"
                ],
                "She/her/hers": [
                  "she"
                ],
                "They/them/theirs": [
                  "they"
                ],
                "Ze/hir/hirs": [
                  "ze"
                ],
                "Xe/xem/xyrs": [
                  "xe"
                ],
                "Ey/em/eirs": [
                  "ey"
                ],
                "Ve/ver/vis": [
                  "ve"
                ],
                "Per/per/pers": [
                  "per"
                ],
                "Ne/nem/nirs": [
                  "ne"
                ],
                "Other": [
                  "other"
                ],
                "I do not want to answer": [
                  "Decline",
                  "I don't wish",
                  "Prefer not"
                ],
                "": [
                  "Decline",
                  "I don't wish",
                  "Prefer not"
                ]
              }
            }
          ]
        },
        {
          "keywords": [
            "pronouns"
          ]
        }
      ],
      [
        "transgender",
        {
          "actions": [
            {
              "path": [
                ".//label[CONTAINS_TEXT('transgender')]/parent::*//select[not(contains(@style, 'display: none'))]",
                ".//select[@name='job_application[transgender]']",
                ".//div[CONTAINS_TEXT('transgender')]"
              ],
              "method": "clickOption",
              "values": {
                "true": [
                  "Yes"
                ],
                "false": [
                  "Decline",
                  "No",
                  "I don't wish",
                  "Prefer not"
                ],
                "": [
                  "Decline",
                  "No",
                  "I don't wish",
                  "Prefer not"
                ]
              }
            }
          ]
        },
        {
          "keywords": [
            "transgender"
          ]
        }
      ],
      [
        "race",
        {
          "actions": [
            {
              "path": [
                ".//select[@name='job_application[race]']",
                ".//div[contains(@id,'select-race')]"
              ],
              "method": "click",
              "options": {
                "unmarkFilledStatusIfSomeFails": true
              }
            },
            {
              "path": [
                ".//label[CONTAINS_TEXT('race') or CONTAINS_TEXT('racial') or CONTAINS_TEXT('ethnic')]/parent::*//select[not(contains(@style, 'display: none'))]",
                ".//select[@name='job_application[race]']",
                ".//div[contains(@class, 'field') and CONTAINS_TEXT('race') or CONTAINS_TEXT('racial') or CONTAINS_TEXT('ethnic')]",
                ".//div[CONTAINS_TEXT('white') or CONTAINS_TEXT('races')]",
                "//fieldset[@class='checkbox' and legend[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'race/ethnicity you identify')]]"
              ],
              "method": "clickOption",
              "values": {
                "Black or African American": [
                  "Black",
                  "African"
                ],
                "East Asian": [
                  "East Asian",
                  "Asian"
                ],
                "Hispanic or Latino": "Hispanic",
                "Southeast Asian": [
                  "Southeast Asian",
                  "Asian"
                ],
                "South Asian": [
                  "South Asian",
                  "Asian"
                ],
                "Native Hawaiian or Other Pacific Islander": [
                  "Native Hawaiian",
                  "Pacific Islander"
                ],
                "American Indian or Alaska Native": [
                  "American Indian",
                  "Alaskan Native"
                ],
                "White": "White",
                "Two or More Races": "Two or More",
                "Some Other Race": [
                  "Other",
                  "Decline"
                ],
                "Decline to Answer": [
                  "Decline",
                  "Prefer not"
                ],
                "": [
                  "Decline"
                ]
              }
            }
          ]
        },
        {
          "keywords": [
            "racial/ethnic",
            " specify the race"
          ]
        }
      ],
      [
        "veteran",
        [
          {
            "actions": [
              {
                "path": [
                  "//label[contains(text(), 'Protected Veteran Status')]/following-sibling::div//div[contains(@class, 'select__placeholder') and contains(text(), 'Select')]"
                ],
                "method": "click",
                "options": {
                  "unmarkFilledStatusIfSomeFails": true
                }
              },
              {
                "path": [
                  ".//div[contains(@class, 'select__menu-list') and @role='listbox']"
                ],
                "method": "clickOption",
                "values": {
                  "true": [
                    "I am a ",
                    "I identify ",
                    "Yes"
                  ],
                  "false": [
                    "I am not a ",
                    "No"
                  ],
                  "": [
                    "Decline",
                    "I am not a ",
                    "I don't ",
                    "No",
                    "Prefer not"
                  ]
                }
              }
            ]
          },
          {
            "actions": [
              {
                "path": [
                  "//label[contains(text(), 'Veteran Status') and not(contains(text(), 'Protected Veteran Status')) ]/following-sibling::div//div[contains(@class, 'select__placeholder') and contains(text(), 'Select')]"
                ],
                "method": "click",
                "options": {
                  "unmarkFilledStatusIfSomeFails": true
                }
              },
              {
                "path": [
                  ".//div[CONTAINS_TEXT('veteran')]",
                  ".//label[CONTAINS_TEXT('veteran')]/parent::*//select[not(contains(@style, 'display: none'))]",
                  ".//select[@name='job_application[veteran_status]']",
                  ".//div[contains(@class, 'select__menu-list') and @role='listbox']"
                ],
                "method": "clickOption",
                "values": {
                  "true": [
                    "I am a ",
                    "I identify ",
                    "Yes"
                  ],
                  "false": [
                    "I am not a ",
                    "No"
                  ],
                  "": [
                    "Decline",
                    "I am not a ",
                    "I don't ",
                    "No",
                    "Prefer not"
                  ]
                }
              }
            ]
          }
        ],
        {
          "keywords": [
            "veteran"
          ]
        }
      ],
      [
        "disability",
        [
          {
            "actions": [
              {
                "path": [
                  "(//label[contains(text(), 'Disability')]/following-sibling::div//div[contains(@class, 'select__placeholder') and contains(text(), 'Select')])[1]/following-sibling::div"
                ],
                "method": "click",
                "options": {
                  "unmarkFilledStatusIfSomeFails": true
                }
              },
              {
                "path": [
                  ".//div[contains(@class, 'select__menu remix')]"
                ],
                "method": "clickOption",
                "values": {
                  "true": [
                    "Yes",
                    "I have"
                  ],
                  "false": [
                    "No",
                    "I do not have",
                    "Prefer not"
                  ],
                  "": [
                    "Decline",
                    "I don't wish",
                    "Prefer not",
                    "No"
                  ]
                }
              }
            ]
          },
          {
            "actions": [
              {
                "path": [
                  "//div[contains(@id, 'select-disability_status-placeholder')]"
                ],
                "method": "click",
                "options": {
                  "unmarkFilledStatusIfSomeFails": true
                }
              },
              {
                "path": [
                  ".//label[CONTAINS_TEXT('disability')]/parent::*//select[not(contains(@style, 'display: none'))]",
                  ".//select[@name='job_application[disability_status]']",
                  ".//div[contains(@class, 'select__menu-list') and @role='listbox']"
                ],
                "method": "clickOption",
                "values": {
                  "true": [
                    "Yes",
                    "I have"
                  ],
                  "false": [
                    "No",
                    "I do not have",
                    "Prefer not"
                  ],
                  "": [
                    "Decline",
                    "I don't wish",
                    "Prefer not",
                    "No"
                  ]
                }
              }
            ]
          }
        ],
        {
          "keywords": [
            "disability",
            "chronic condition"
          ]
        }
      ],
      [
        "sexualOrientation",
        {
          "actions": [
            {
              "path": [
                ".//label[CONTAINS_TEXT('sexual') and CONTAINS_TEXT('orient')]/parent::*//select[not(contains(@style, 'display: none'))]",
                ".//select[@name='job_application[sexual_orientation]']",
                ".//div[CONTAINS_TEXT('sexual') and CONTAINS_TEXT('orient')]"
              ],
              "method": "clickOption",
              "values": {
                "Heterosexual (straight)": [
                  "Heterosexual",
                  "Straight"
                ],
                "Homosexual (gay/lesbian)": [
                  "Homosexual",
                  "Gay",
                  "Lesbian"
                ],
                "Bisexual": [
                  "Bisexual"
                ],
                "Pansexual": [
                  "Pansexual"
                ],
                "Asexual": [
                  "Asexual"
                ],
                "Queer": [
                  "Queer"
                ],
                "Questioning/Uncertain": [
                  "Questioning",
                  "Uncertain"
                ],
                "Other": [
                  "Other"
                ],
                "I do not want to answer": [
                  "Decline",
                  "No",
                  "I don't wish",
                  "Prefer not"
                ]
              }
            }
          ]
        },
        {
          "keywords": [
            "sexual"
          ]
        }
      ],
      [
        "github",
        [
          ".//input[contains(translate(@autocomplete, 'GITHUB', 'github'), 'github')]",
          ".//label[CONTAINS_TEXT('github')]/parent::*//input[@type='text']"
        ],
        {
          "keywords": [
            "github"
          ]
        }
      ],
      [
        "twitter",
        [
          ".//input[contains(translate(@autocomplete, 'TWITTER', 'twitter'), 'twitter')]",
          ".//label[CONTAINS_TEXT('twitter')]/parent::div//input[@type='text']"
        ],
        {
          "keywords": [
            "twitter"
          ]
        }
      ],
      [
        "behance",
        [
          ".//input[contains(translate(@autocomplete, 'BEHANCE', 'behance'), 'behance')]",
          ".//label[CONTAINS_TEXT('behance')]/parent::div//input[@type='text']"
        ],
        {
          "keywords": [
            "behance"
          ]
        }
      ]
    ]
  },
  "hireology": {
    "atsName": "hireology",
    "urls": [
      "*://careers.hireology.com/*/*/description"
    ],
    "urlsExclude": [],
    "questionsInSubmitPage": true,
    "submitButtonPaths": [
      ".//button[@data-qa-id='submit']"
    ],
    "nextStepButtonPaths": [],
    "nextStepDynamicLoad": false,
    "validationErrorXPaths": [],
    "validationErrorPersistent": false,
    "errorBannerXPaths": [],
    "questionValidationErrorSelectors": [
      "div.careers-input-error"
    ],
    "formLoadingXPaths": [
      ".//section[@class='careers-apply-form__loader']"
    ],
    "validationCheckFormValidity": false,
    "validateUsingQuestionErrorSelectors": true,
    "targetNodeXPath": [
      ".//div[@id='application']"
    ],
    "targetFrameNodeXPath": [],
    "networkOptions": {
      "blacklistedUrlParts": [
        "linkedin",
        "analytics",
        "insights",
        "track",
        "blob",
        "parseResume",
        "google",
        "launchdarkly",
        "extdocs"
      ]
    },
    "canJobBeAppliedXPaths": {
      "applyButton": [],
      "submitButton": "",
      "email": [],
      "next": []
    },
    "customQuestions": {
      "patterns": {
        "questionId": "",
        "innerSelectors": [],
        "selectInputTagName": "",
        "selectInputAttrName": "",
        "selectInputAttrValue": "",
        "radioGroupMatchQuerySelector": "",
        "fieldsetMatchQuerySelector": "",
        "maxLabelLevel": "",
        "radioGroupAttrName": "",
        "radioGroupAttrValue": "",
        "listboxTagName": ""
      },
      "selectors": {
        "question": "div[class*='__inner-container']",
        "title": "div[class*='__fieldset-title']",
        "subTitle": "div[class*='__fieldset-title']",
        "label": "label",
        "legend": "legend",
        "roleOption": "[role='option']",
        "radioInput": "input[type='radio']",
        "monthInput": "input[aria-valuetext='MM'], input[type='month']",
        "dateInput": "input[aria-valuetext='DD']",
        "yearInput": "input[aria-valuetext='YYYY']",
        "checkbox": "input[type='checkbox']",
        "questionParent": "div[class*='__outer-container']"
      },
      "xpaths": {
        "currentListItem": [],
        "listInputBackBtnText": [],
        "selectPopupXPath": [],
        "listBoxPopupXPath": [],
        "selectedItemListXPath": [],
        "requiredFieldXPath": [
          "//input[@id=//label[contains(text(), '(required)')]/@for]"
        ],
        "targetNodeXPath": []
      },
      "ignoreQuestions": [
        "//select[contains(@data-qa-id, 'location_state_id-')]"
      ],
      "ignoreContainerQuestions": []
    },
    "jobXPaths": {
      "entities": [
        [
          "titleDisplay",
          [
            ".//h1[contains(@class,'header__title')]"
          ]
        ],
        [
          "originalCompanyName",
          [
            ""
          ]
        ],
        [
          "jobTypes",
          []
        ],
        [
          "postingDate",
          []
        ],
        [
          "url",
          []
        ],
        [
          "desc",
          []
        ],
        [
          "locationDisplay",
          []
        ],
        [
          "location",
          []
        ]
      ]
    },
    "preApply": {
      "urls": [],
      "entities": [
        [
          "consent",
          {}
        ],
        [
          "phoneStrippedCountryCode",
          {}
        ],
        [
          "continueButton",
          {}
        ],
        [
          "chooseVerificationMethod",
          {}
        ],
        [
          "sendButton",
          {}
        ]
      ],
      "urlsExclude": []
    },
    "entities": [
      [
        "answerSource",
        []
      ],
      [
        "applyBtn",
        {}
      ],
      [
        "firstName",
        [
          ".//input[contains(@data-qa-id, 'first_name') or contains(@id, 'first_name')]"
        ]
      ],
      [
        "lastName",
        [
          ".//input[contains(@data-qa-id, 'last_name') or contains(@id, 'last_name')]"
        ]
      ],
      [
        "preferredFirstName",
        []
      ],
      [
        "legalFirstName",
        []
      ],
      [
        "legalLastName",
        []
      ],
      [
        "fullName",
        []
      ],
      [
        "email",
        [
          ".//input[contains(@data-qa-id, 'email_address') or contains(@id, 'email_address')]"
        ]
      ],
      [
        "phone",
        [
          ".//input[contains(@data-qa-id, 'home_phone') or contains(@id, 'home_phone')]"
        ]
      ],
      [
        "addressLine1",
        [
          ".//input[contains(@data-qa-id, 'street_address') or contains(@id, 'street_address')]"
        ]
      ],
      [
        "recentExperience.companyName",
        []
      ],
      [
        "recentExperience.title",
        []
      ],
      [
        "city",
        [
          ".//input[contains(@data-qa-id, 'city') or contains(@id, 'city')]"
        ]
      ],
      [
        "state",
        {
          "actions": [
            {
              "path": [
                ".//select[contains(@data-qa-id, 'state_id') or contains(@id, 'state_id')]"
              ],
              "method": "clickOption"
            }
          ]
        }
      ],
      [
        "stateName",
        []
      ],
      [
        "postalCode",
        [
          ".//input[contains(@data-qa-id, 'zip_code') or contains(@id, 'zip_code')]"
        ]
      ],
      [
        "cityStateName",
        []
      ],
      [
        "country",
        []
      ],
      [
        "resume",
        {
          "actions": [
            {
              "path": [
                ".//input[contains(@data-qa-id, 'resume') or contains(@id, 'resume') and contains(@type, 'file')]"
              ],
              "method": "uploadResume",
              "options": {
                "waitForNetworkBeforeInteraction": true
              }
            }
          ]
        }
      ],
      [
        "minYearlySalaryDesired",
        [
          {
            "actions": [
              {
                "path": [
                  ".//input[contains(@data-qa-id, 'desired_compensation') or contains(@id, 'desired_compensation')]"
                ],
                "method": "setValue",
                "userDataParam": "__minYearlySalaryDesired__"
              },
              {
                "path": [
                  ".//select[contains(@data-qa-id, 'desired_compensation_unit') or contains(@id, 'desired_compensation_unit')]"
                ],
                "method": "clickOption",
                "options": {
                  "fallbackOption": "Base",
                  "forceFallbackOption": true
                }
              }
            ]
          }
        ]
      ],
      [
        "workStartDateAvailabilityString",
        {
          "actions": [
            {
              "method": "setDateInput",
              "format": "MM/dd/yyyy",
              "fullDate": {
                "path": [
                  ".//input[contains(@data-qa-id, 'earliest_availability') or contains(@id, 'earliest_availability')]"
                ],
                "format": "yyyy-MM-dd"
              }
            }
          ]
        }
      ],
      [
        "experience",
        {
          "addButtonPath": [
            "//a[contains(@class, 'careers-apply-form-add__link') and not(contains(normalize-space(.), 'amount'))]"
          ],
          "confirmAddedPath": [
            "(//a[contains(@class, 'careers-apply-form-remove__link') or contains(@class, 'careers-apply-form-add__link')]/parent::div/parent::div/parent::div)[__indexPlusOne__]"
          ],
          "containerPath": [
            "(//a[contains(@class, 'careers-apply-form-remove__link') or contains(@class, 'careers-apply-form-add__link')]/parent::div/parent::div/parent::div)[__indexPlusOne__]",
            "(//div[CONTAINS_TEXT('work') and CONTAINS_TEXT('history')]/parent::div)[__indexPlusOne__]",
            ".//div[not(@class) and not(@id) and .//input[@id='location_city-__index__']]"
          ],
          "entities": [
            [
              "companyName",
              [
                "//input[contains(@data-qa-id, 'company_name-__index__') or contains(@id, 'company_name-__index__')]"
              ]
            ],
            [
              "city",
              [
                "//input[contains(@data-qa-id, 'location_city-__index__') or contains(@id, 'location_city-__index__')]"
              ]
            ],
            [
              "state",
              {
                "actions": [
                  {
                    "path": [
                      "//select[contains(@data-qa-id, 'location_state_id-__index__') or contains(@id, 'location_state_id-__index__')]"
                    ],
                    "method": "clickOption"
                  }
                ]
              }
            ],
            [
              "title",
              [
                "//input[contains(@data-qa-id, 'job_title_held-__index__') or contains(@id, 'job_title_held-__index__')]"
              ]
            ],
            [
              "cityState",
              []
            ],
            [
              "isCurrent",
              {
                "actions": [
                  {
                    "path": [
                      "//label[@for='current-__index__']"
                    ],
                    "method": "clickCheckbox"
                  }
                ]
              }
            ],
            [
              "startDate",
              {
                "actions": [
                  {
                    "method": "setDateInput",
                    "format": "MM/yyyy",
                    "fullDate": {
                      "path": [
                        "(//input[contains(@data-qa-id, 'start_date') or contains(@id, 'start_date')])[__indexPlusOne__]"
                      ],
                      "format": "yyyy-MM"
                    }
                  }
                ]
              }
            ],
            [
              "endDate",
              {
                "actions": [
                  {
                    "method": "setDateInput",
                    "format": "MM/yyyy",
                    "fullDate": {
                      "path": [
                        "(//input[contains(@data-qa-id, 'end_date') or contains(@id, 'end_date')])[__indexPlusOne__]"
                      ],
                      "format": "yyyy-MM"
                    }
                  }
                ]
              }
            ],
            [
              "description",
              []
            ]
          ]
        }
      ],
      [
        "over18",
        {}
      ],
      [
        "weekdaysAvailability",
        {}
      ],
      [
        "weekendsAvailability",
        {}
      ],
      [
        "openSchedule",
        {}
      ],
      [
        "flexibleSchedule",
        {}
      ],
      [
        "dayShift",
        {}
      ],
      [
        "nightShift",
        {}
      ],
      [
        "swingShift",
        {}
      ],
      [
        "overnightShift",
        {}
      ],
      [
        "anyShift",
        {}
      ],
      [
        "highestEducationLevel",
        {}
      ],
      [
        "education",
        {
          "addButtonPath": [
            ".//div[text()='Education']/parent::div/following-sibling::div//a[@class='careers-apply-form-add__link']"
          ],
          "confirmAddedPath": [
            "(.//div[text()='Education']/parent::div/following-sibling::div[.//a[@class='careers-apply-form-add__link'] or .//a[@class='careers-apply-form-remove__link']])[__indexPlusOne__]"
          ],
          "containerPath": [
            "(.//div[text()='Education']/parent::div/following-sibling::div[.//a[@class='careers-apply-form-add__link'] or .//a[@class='careers-apply-form-remove__link']])[__indexPlusOne__]"
          ],
          "entities": [
            [
              "name",
              [
                ".//input[contains(@data-qa-id, 'institute_name-__indexPlusOne__') or contains(@id, 'institute_name-__indexPlusOne__')]"
              ]
            ],
            [
              "degree",
              []
            ],
            [
              "major",
              []
            ],
            [
              "startDateMonth_MM",
              []
            ],
            [
              "endDateMonth_MM",
              []
            ],
            [
              "startDateMonthText",
              []
            ],
            [
              "endDateMonthText",
              []
            ],
            [
              "startDateYear",
              []
            ],
            [
              "endDateYear",
              [
                ".//input[contains(@data-qa-id, 'graduation_year-__indexPlusOne__') or contains(@id, 'graduation_year-__indexPlusOne__')]"
              ]
            ],
            [
              "city",
              [
                ".//input[contains(@data-qa-id, 'education_city-__indexPlusOne__') or contains(@id, 'education_city-__indexPlusOne__')]"
              ]
            ],
            [
              "state",
              {
                "actions": [
                  {
                    "path": [
                      ".//select[contains(@data-qa-id, 'education_state_id-__indexPlusOne__') or contains(@id, 'education_state_id-__indexPlusOne__')]"
                    ],
                    "method": "clickOption"
                  }
                ]
              }
            ]
          ]
        }
      ],
      [
        "workAuth",
        [
          ".//select[contains(@data-qa-id, 'legal') or contains(@id, 'legal')]"
        ]
      ],
      [
        "agreement",
        {
          "actions": [
            {
              "path": [
                ".//input[contains(@data-qa-id, 'signature') or contains(@id, 'signature')]"
              ],
              "method": "setValue",
              "userDataParam": "__fullName__"
            }
          ]
        }
      ],
      [
        "sponsorship",
        {}
      ],
      [
        "lift50PoundsWeightAbility",
        {}
      ],
      [
        "gender",
        {
          "actions": [
            {
              "path": [
                ".//select[contains(@data-qa-id, 'gender') or contains(@id, 'gender')]"
              ],
              "method": "clickOption",
              "values": {
                "Male": [
                  "Male",
                  "Man"
                ],
                "Female": [
                  "Female",
                  "Woman"
                ],
                "I do not want to answer": [
                  "Decline",
                  "I don't wish",
                  "Prefer not"
                ],
                "": [
                  "Decline",
                  "I don't wish",
                  "Prefer not"
                ]
              }
            }
          ]
        }
      ],
      [
        "hispanicLatino",
        {
          "actions": [
            {
              "path": [
                ".//select[contains(@data-qa-id, 'is_hispanic') or contains(@id, 'is_hispanic')]"
              ],
              "method": "clickOption",
              "values": {
                "true": [
                  "Yes",
                  "Hispanic"
                ],
                "false": [
                  "No",
                  "Not Hispanic",
                  "Prefer not"
                ],
                "": [
                  "Decline",
                  "No",
                  "I don't wish",
                  "Prefer not"
                ]
              }
            }
          ]
        }
      ],
      [
        "genderPronouns",
        {}
      ],
      [
        "transgender",
        {}
      ],
      [
        "race",
        {
          "actions": [
            {
              "path": [
                ".//select[contains(@data-qa-id, 'race') or contains(@id, 'race')]"
              ],
              "method": "clickOption",
              "values": {
                "Black or African American": [
                  "Black",
                  "African"
                ],
                "East Asian": [
                  "East Asian",
                  "Asian"
                ],
                "Hispanic or Latino": "Hispanic",
                "Southeast Asian": [
                  "Southeast Asian",
                  "Asian"
                ],
                "South Asian": [
                  "South Asian",
                  "Asian"
                ],
                "Native Hawaiian or Other Pacific Islander": [
                  "Native Hawaiian",
                  "Pacific Islander"
                ],
                "American Indian or Alaska Native": [
                  "American Indian",
                  "Alaskan Native"
                ],
                "White": "White",
                "Two or More Races": "Two or More",
                "Some Other Race": [
                  "Other",
                  "Decline"
                ],
                "Decline to Answer": [
                  "Decline",
                  "Prefer not"
                ],
                "": [
                  "Decline"
                ]
              }
            }
          ]
        }
      ],
      [
        "veteran",
        {
          "actions": [
            {
              "path": [
                ".//select[contains(@data-qa-id, 'veteran_status') or contains(@id, 'veteran_status')]",
                "//div[contains(@id, 'military')]"
              ],
              "method": "clickOption",
              "values": {
                "true": [
                  "I am a ",
                  "I identify ",
                  "Yes"
                ],
                "false": [
                  "I am not a ",
                  "I don't ",
                  "No",
                  "Prefer not"
                ],
                "": [
                  "Decline",
                  "I am not a ",
                  "I don't ",
                  "No",
                  "Prefer not"
                ]
              }
            }
          ]
        }
      ],
      [
        "disability",
        {
          "actions": [
            {
              "path": [
                ".//select[contains(@data-qa-id, 'disability') or contains(@id, 'disability')]"
              ],
              "method": "clickOption",
              "values": {
                "true": [
                  "Yes",
                  "I have"
                ],
                "false": [
                  "No",
                  "I do not have",
                  "Prefer not"
                ],
                "": [
                  "Decline",
                  "I don't wish",
                  "Prefer not",
                  "No"
                ]
              }
            }
          ]
        }
      ],
      [
        "sexualOrientation",
        {}
      ],
      [
        "linkedin",
        []
      ],
      [
        "github",
        []
      ],
      [
        "twitter",
        []
      ],
      [
        "behance",
        []
      ],
      [
        "countryName",
        []
      ],
      [
        "phoneStripped",
        []
      ],
      [
        "phoneCode",
        []
      ],
      [
        "deviceType",
        {}
      ],
      [
        "certification",
        {
          "addButtonPath": [],
          "confirmAddedPath": [],
          "containerPath": [],
          "entities": [
            [
              "name",
              []
            ],
            [
              "issueDateSlashes_MMDDYYYY",
              []
            ]
          ]
        }
      ],
      [
        "skill",
        {
          "containerPath": [],
          "entities": [
            [
              "name",
              []
            ]
          ],
          "options": {
            "clickOutsideAtEnd": false
          }
        }
      ],
      [
        "lgbt",
        {}
      ],
      [
        "armedForces",
        {}
      ],
      [
        "currentDate",
        []
      ],
      [
        "currentDateDashes",
        {}
      ],
      [
        "language",
        {}
      ],
      [
        "privacyAgreement",
        {}
      ],
      [
        "middleName",
        {}
      ],
      [
        "street",
        []
      ],
      [
        "cityLocated",
        []
      ],
      [
        "phoneType",
        {}
      ],
      [
        "phoneFormatted",
        []
      ],
      [
        "homePhoneFormatted",
        []
      ],
      [
        "referral",
        {}
      ],
      [
        "applyDate",
        {}
      ],
      [
        "birthMonth",
        {}
      ],
      [
        "birthDay",
        {}
      ],
      [
        "birthYear",
        {}
      ],
      [
        "addressType",
        {}
      ],
      [
        "startMonthAvailabilityString",
        {}
      ],
      [
        "startDayAvailabilityString",
        {}
      ],
      [
        "startYearAvailabilityString",
        []
      ],
      [
        "county",
        {}
      ],
      [
        "nameInitials",
        []
      ],
      [
        "addressLine2",
        []
      ],
      [
        "highestEducation.name",
        []
      ],
      [
        "highestEducation.degreeDisplay",
        []
      ],
      [
        "workStartDateAvailability",
        []
      ],
      [
        "currencyType",
        {}
      ],
      [
        "willingToWorkHolidays",
        {}
      ],
      [
        "employmentInvoluntarilyTerminated",
        {}
      ],
      [
        "startMonthNameAvailabilityString",
        {}
      ],
      [
        "cityState",
        {}
      ]
    ],
    "globalOptions": {
      "waitForAllRequestsBeforeFillingStep": false
    },
    "signIn": {
      "urls": [],
      "formPath": [],
      "submitButton": [],
      "toSignInButton": [],
      "createAccount": [],
      "forgotPassword": [],
      "email": [],
      "password": [],
      "errorMessage": [],
      "endpoint": "",
      "verifyPassword": [],
      "isInlineForm": false,
      "isEmailRequired": false,
      "errorPersistAfterReload": false
    },
    "signUp": {
      "errorMessage": [],
      "submitButton": [],
      "formStepPath": [],
      "email": [],
      "password": [],
      "verifyPassword": [],
      "endpoint": "",
      "saveStrategy": "",
      "urls": [],
      "verifyEmail": [],
      "userName": []
    },
    "nextStepButtonFallbackToParentFrame": false,
    "confirmSubmittedForm": {
      "confirmMessageXPath": [],
      "urls": []
    },
    "attachedContainer": [],
    "alwaysSyncWindowId": false
  },
  "icims": {
    "atsName": "icims",
    "urls": [
      "*://*.icims.com/jobs/*/*/candidate*",
      "*://*.icims.eu/jobs/*/*/candidate*",
      "*://*.icims.com/jobs/*/*/eeo*",
      "*://*.icims.eu/jobs/*/*/eeo*",
      "*://*.icims.com/jobs/*/*/form*",
      "*://*.icims.eu/jobs/*/*/form*",
      "*://*.icims.com/jobs/*/*/questions*",
      "*://*.icims.eu/jobs/*/*/questions*",
      "*://*.icims.com/jobs/*/*/assessment*",
      "*://*.icims.eu/jobs/*/*/assessment*",
      "*://*.icims.com/jobs/gdpr*",
      "*://*.icims.eu/jobs/gdpr*",
      "*://*.icims.com/forms*",
      "*://*.icims.eu/forms*",
      "*://*.icims.com/*/login/password*",
      "*://*.icims.eu/*/login/password*",
      "*://*.icims.com/*/login?*",
      "*://*.icims.eu/*/login?*",
      "*://*.icims.com/*/mfa-detect-browser-capabilities*",
      "*://*.icims.eu/*/mfa-detect-browser-capabilities*"
    ],
    "urlsExclude": [],
    "submitButtonPaths": [],
    "questionsInSubmitPage": true,
    "globalOptions": {
      "waitForAllRequestsBeforeFillingStep": true,
      "waitForInteractionNetworkRequests": true
    },
    "networkOptions": {
      "blacklistedUrlParts": [
        "form=employment_application"
      ],
      "allowedUrlParts": [
        "in_iframe"
      ],
      "preApplyCheck": true
    },
    "nextStepButtonPaths": [
      ".//input[@type='submit' and contains(@class, 'SubmitButton') and not(@id='enterEmailSubmitButton')]",
      ".//input[@type='submit' and contains(@value, 'Submit') and not(@id='enterEmailSubmitButton') and not(contains(@name, 'Resume')) and not(contains(@value, 'Resume')) and not(contains(@value, 'Print'))]",
      ".//input[@type='submit' and contains(@class, 'PrimaryButton')]",
      ".//input[@type='submit' and contains(@name, 'icims_submit')]",
      ".//*[contains(@class, 'assessmentLink')]//button[@id='submit']",
      ".//form//button[@type='submit' and @value='refuse-add-device']"
    ],
    "disableBeforeUnloadEvent": true,
    "validationErrorPersistent": true,
    "ignoreInitAnswersNeeded": true,
    "validationErrorXPaths": [
      ".//span[@id='error-element-password']",
      ".//div[contains(@class, 'iCIMS_ErrorMessage') and normalize-space(text()) != '' and not(contains(@style, 'display:none')) and not(contains(@style, 'visibility:hidden')) and not(contains(@class, 'NoDisplay'))]",
      ".//div[@id='icims-form-error-container']",
      ".//div[@id='iCIMS_ErrorMessage_login_i']"
    ],
    "errorBannerXPaths": [
      ".//div[@id='beanErrorys']//div[@role='alert']",
      ".//div[@role='alert' and contains(@class, 'iCIMS_ErrorMessage') and normalize-space(text()) != '' and not(contains(@style, 'display:none')) and not(contains(@style, 'visibility:hidden')) and not(contains(@class, 'NoDisplay'))]"
    ],
    "targetNodeXPath": [
      ".//form[@id='profileForm']",
      ".//form[@id='enterEmailForm']",
      ".//form[@name='icims_form']",
      ".//main[contains(@class, 'widget') and contains(@class, 'login')]",
      ".//div[contains(@class, 'iCIMS_MainWrapper') and contains(@class, 'iCIMS_AssessmentPage')]",
      ".//div[contains(@class, 'iCIMS_MainWrapper') and contains(@class, 'iCIMS_FormsPage')]",
      ".//form[contains(@class, 'iCIMS_FormMainStyle')]",
      ".//main[contains(@class, 'widget')]//div[contains(@class, 'ulp-')]"
    ],
    "questionValidationErrorSelectors": [
      "[aria-describedby*='error']"
    ],
    "formLoadingXPaths": [
      ".//input[@type='submit' and contains(@class, 'loading') and @disabled]"
    ],
    "formLoadingAfterNextStepClick": true,
    "canJobBeAppliedXPaths": {
      "refuseAddDevice": [
        ".//form//button[@type='submit' and CONTAINS_TEXT('Not on this device')]",
        ".//form//button[@type='submit' and @value='refuse-add-device']"
      ],
      "applyButton": [
        ".//form[@id='enterEmailForm']//input[@id='enterEmailSubmitButton']",
        ".//a[contains(@class, 'iCIMS_Action_Button') and contains(@class, 'iCIMS_ApplyOnlineButton')]",
        ".//div//button[@type='submit' and normalize-space(.) != '']"
      ],
      "email": [
        ".//form[@id='enterEmailForm']//input[@id='email']",
        ".//div//input[@id='username']",
        ".//form//input[@id='email']"
      ],
      "next": [
        ".//form//button[@type='submit' and CONTAINS_TEXT('Not on this device')]",
        ".//form//button[@type='submit' and @value='refuse-add-device']",
        ".//form[@id='enterEmailForm']//input[@id='enterEmailSubmitButton']",
        ".//div//button[@type='submit' and normalize-space(.) != '']"
      ]
    },
    "confirmSubmittedForm": {
      "confirmMessageXPath": [
        ".//div[contains(@class, 'iCIMS_MainWrapper')]//div[contains(@class, 'iCIMS_SuccessMessage')]"
      ],
      "urls": [
        "*://*.icims.com/jobs/*?*mode=submit_apply*",
        "*://*.icims.eu/jobs/*?*mode=submit_apply*"
      ]
    },
    "targetFrameNodeXPath": [
      ".//form[@id='profileForm']",
      ".//form[@id='enterEmailForm']",
      ".//form[@name='icims_form']",
      ".//div[(contains(@class, 'iCIMS_JobContainer') or contains(@class, 'iCIMS_MainWrapper') or contains(@class, 'ulp-awaiting-action-outer')) and not(.//iframe[@id='icims_formFrame'])]",
      ".//div[contains(@class, 'iCIMS_MainWrapper') and contains(@class, 'iCIMS_AssessmentPage')]",
      ".//div[contains(@class, 'iCIMS_MainWrapper') and contains(@class, 'iCIMS_FormsPage') and not(./descendant::iframe[@id='icims_formFrame'])]",
      ".//div[contains(@class, 'iCIMS_MainWrapper') and contains(@class, 'iCIMS_LoginPage')]",
      ".//div[contains(@class, 'iCIMS_MainWrapper') and contains(@class, 'CandidateRequestPage')]"
    ],
    "expiredJob": [
      {
        "container": [
          ".//h1"
        ],
        "keywords": [
          "error"
        ]
      }
    ],
    "customQuestions": {
      "patterns": {
        "questionId": "",
        "innerSelectors": [],
        "selectInputXPath": [
          "//a[contains(@class, 'dropdown-select')]"
        ],
        "selectInputTagName": "select",
        "selectInputAttrName": "icimsdropdown-enabled",
        "selectInputAttrValue": "1",
        "radioGroupMatchQuerySelector": "[data-sja-question-group='radio']",
        "fieldsetMatchQuerySelector": "[data-sja-question-group='checkbox']"
      },
      "selectors": {
        "question": "",
        "questionXPath": [
          "//input[not(@type='password') and not(@type='button') and not(@type='submit') and not(@type='reset') and not(@type='image') and not(@type='file') and not(@type='checkbox') and not(@type='radio') and not(@type='range') and not(@type='color') and not(@type='hidden') and not(contains(@class, 'dropdown-search')) and not(contains(@style, 'display: none'))]",
          "//textarea[contains(@class, 'iCIMS') or contains(@id, 'ProfileFields')]",
          "//select[not(contains(@style, 'display: none'))]",
          "//a[contains(@class, 'dropdown-select')]",
          "//span[contains(@class, 'RadioGroup')]//input[@type='radio']",
          "//div[contains(@class, 'SignUpContainer')]//div[@class='checkbox']//input[@type='checkbox']",
          "//span[contains(@class, 'customFieldContainer')]//input[@type='checkbox']"
        ],
        "title": "h1",
        "label": "label[for^='__questionId__']",
        "legend": "legend[for^='__questionId__']",
        "ariaLabelledBy": "label[for^='__labelFor__']",
        "roleOption": "[role='option'], option",
        "radioInput": "input[type='radio']",
        "monthInput": "input[aria-valuetext='MM']",
        "dateInput": "input[aria-valuetext='DD']",
        "yearInput": "input[aria-valuetext='YYYY']",
        "checkbox": "input[type='checkbox']",
        "mapOption": "[role='option']"
      },
      "xpaths": {
        "currentListItem": [],
        "listInputBackBtnText": [],
        "selectPopupXPath": [
          "//div[contains(@class, 'dropdown-container') and not(contains(@class, 'dropdown-invisible'))]"
        ],
        "listBoxPopupXPath": [
          "//div[contains(@class, 'dropdown-container') and not(contains(@class, 'invisible'))]//ul[contains(@class, 'dropdown-results')]",
          ".//tr[td//input[@type='checkbox']]"
        ],
        "selectedItemListXPath": [
          "//div[contains(@class, 'select2-drop-active') and @id='select2-drop']//input[contains(@class, 'select2-input')]"
        ],
        "requiredFieldXPath": [
          "following-sibling::*[@class='Field_Required']",
          ".//span[CONTAINS_TEXT('*', true) or contains(@class, 'Field_Required') or contains(@class, 'Field_RequiredStar')]",
          "//input[@i_required='true']",
          "self::label[@data-sja-required]"
        ]
      },
      "ignoreQuestions": [
        "//select[contains(@id, 'CandProfileFields.Degree')]",
        "//input[@type='radio' and contains(@id, 'ProvideLicense')]",
        "//input[@type='radio' and contains(@id, 'ProvideEducation')]",
        "//input[@type='text' and contains(@id, 'OtherSchool')]",
        "//input[@type='text' and contains(@id, 'Login')]",
        "//input[@type='password']",
        "//input[@type='password' and contains(@id, 'Password_Confirm')]",
        "//a[contains(@id, 'AddressState') and contains(@class, 'dropdown-select')]",
        "//a[contains(@id, 'AddressCountry') and contains(@class, 'dropdown-select')]"
      ],
      "ignoreContainerQuestions": [
        ".//div[contains(@data-group-loop-name, 'Work_Exp') or contains(@id, 'Work_Exp')]",
        ".//div[contains(@data-group-loop-name, 'Education_GL')]",
        ".//div[contains(@data-group-loop-name, 'Licenses_GL')]",
        ".//span[contains(@class,'iCIMS_LabelText') and contains(normalize-space(.),'Education') and not(contains(normalize-space(.),'Additional'))]//ancestor::div[contains(@class,'iCIMS_CollectionContainer') and not(contains(@class,'NoDisplay')) and parent::div[preceding-sibling::h2[contains(normalize-space(.),'Additional Education')]]]",
        ".//div[contains(@class, 'iCIMS_Forms_QDate') or contains(@class, 'iCIMS_Forms_QName')]",
        ".//div[contains(@class, 'iCIMS_CollectionContainer')][.//legend[contains(., 'License') or contains(., 'Certification')]]"
      ],
      "postSubmitValidationErrors": [
        "over the maximum length"
      ]
    },
    "jobXPaths": {
      "entities": [
        [
          "titleDisplay",
          [
            ".//div[@id='app_body']//h1[@class='app-title']",
            ".//div[@class='section-body']/h1",
            ".//div[contains(@class, 'iCIMS_JobsTable')]//div[contains(@class, 'title')]//h1[contains(@class, 'iCIMS_Header')]"
          ]
        ],
        [
          "originalCompanyName",
          [
            "substring(normalize-space(.//div[@id='app_body']//span[@class='company-name']/text()), 4)",
            "substring-after(.//meta[(@property='og:site_name' or @name='application-name') and starts-with(@content, 'Careers at ')]/@content, 'Careers at ')",
            ".//meta[@property='og:site_name' or @name='application-name']/@content",
            ".//img/@alt"
          ]
        ],
        [
          "jobTypes",
          []
        ],
        [
          "postingDate",
          []
        ],
        [
          "url",
          []
        ],
        [
          "desc",
          [
            ".//div[@id='app_body']//div[@id='content']",
            ".//*[@id='main']//div[@class='page-positions__content']",
            ".//ion-content/main/ng-component/section/article/markdown[descendant::div[@class='content-intro']]"
          ]
        ],
        [
          "locationDisplay",
          [
            ".//div[@id='app_body']//div[@class='location']",
            "//div[contains(@class,'iCIMS_JobsTable')]//span[translate(normalize-space(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz')='job locations']/following-sibling::span[1]"
          ]
        ]
      ]
    },
    "preApply": {
      "urls": [
        "*://*.icims.com/jobs/*/*/login*",
        "*://*.icims.eu/jobs/*/*/login*",
        "*://*.icims.com/jobs/*/*/job",
        "*://*.icims.com/jobs/*/job?",
        "*://*.icims.eu/jobs/*/*/job",
        "*://*.icims.com/*/login/identifier*",
        "*://*.icims.eu/*/login/identifier*",
        "*://*.icims.com/*/mfa-webauthn-platform-enrollment",
        "*://*.icims.eu/*/mfa-webauthn-platform-enrollment"
      ],
      "urlsExclude": [],
      "entities": [
        [
          "refuseAddDevice",
          {
            "actions": [
              {
                "key": "canJobBeAppliedXPaths.refuseAddDevice",
                "method": "click",
                "options": {
                  "preventOtherEntitiesFromFilling": true
                }
              }
            ]
          }
        ],
        [
          "email",
          [
            {
              "actions": [
                {
                  "key": "canJobBeAppliedXPaths.email",
                  "method": "setValue"
                },
                {
                  "key": "canJobBeAppliedXPaths.next",
                  "method": "click"
                },
                {
                  "path": [
                    ".//a[contains(@title, 'Apply')]",
                    ".//a[contains(@title, 'Submit') and contains(@title, 'profile') and contains(@title, 'online')]"
                  ],
                  "method": "click"
                }
              ]
            }
          ]
        ],
        [
          "privacyAgreement",
          {
            "actions": [
              {
                "path": [
                  "//input[@type='checkbox' and @id='accept_gdpr']",
                  "//input[@type='checkbox' and @id='accept_privacy']"
                ],
                "method": "clickMultiple",
                "options": {
                  "checkElementVisibility": true
                }
              }
            ]
          }
        ],
        [
          "applyBtn",
          {
            "actions": [
              {
                "key": "canJobBeAppliedXPaths.applyButton",
                "method": "click"
              }
            ]
          }
        ]
      ],
      "restartAfterDelay": 2000,
      "continueFilling": true
    },
    "signIn": {
      "urls": [
        "*://*.icims.com/*/login/password*",
        "*://*.icims.eu/*/login/password*"
      ],
      "submitButton": [
        "//div[@role='alert']//a[CONTAINS_TEXT('login')]",
        "//button[CONTAINS_TEXT('log in')]",
        "//button[contains(@class, 'login') and not(@data-accounttype) and not(ancestor::div[contains(@class, 'iCIMS_SocialSelection')])]"
      ],
      "createAccount": [],
      "forgotPassword": [],
      "email": [
        "//input[@id='PersonProfileFields.Login']",
        "//main[contains(@class, 'widget') and contains(@class, 'login')]//input[@name='username']"
      ],
      "password": [
        "//input[@id='PersonProfileFields.Password']",
        "//main[contains(@class, 'widget') and contains(@class, 'login')]//input[@name='password']"
      ],
      "verifyPassword": [
        "//input[@id='PersonProfileFields.Password_Confirm']"
      ],
      "errorMessage": [
        "//span[@id='error-element-password']",
        "//div[@id='prompt-alert']"
      ],
      "endpoint": "/login",
      "isInlineForm": true,
      "isEmailRequired": false,
      "errorPersistAfterReload": true,
      "recaptchaXpath": [
        "//iframe[@title='reCAPTCHA']",
        "//iframe[@data-hcaptcha-widget-id]"
      ],
      "wrongCredentialsError": [
        ".//div[contains(@class, 'iCIMS_ErrorMessage') and normalize-space(text()) != '' and not(contains(@style, 'display:none')) and not(contains(@style, 'visibility:hidden')) and not(contains(@class, 'NoDisplay')) and CONTAINS_TEXT('email', true) and CONTAINS_TEXT('already', true)]"
      ]
    },
    "signUp": {
      "errorMessage": [
        "//span[@id='error-element-password']",
        "//div[@id='prompt-alert']"
      ],
      "submitButton": [
        "//main[contains(@class, 'widget') and contains(@class, 'login')]//button[@type='submit']",
        "//input[@type='submit' and @value ='Submit Profile']"
      ],
      "email": [
        "//input[@id='PersonProfileFields.Login']",
        "//main[contains(@class, 'widget') and contains(@class, 'login')]//input[@name='username']"
      ],
      "verifyEmail": [
        "//div[contains(@class, 'iCIMS_ProfileFormTable')]//input[@type='email' and @id = //label[CONTAINS_TEXT('confirm email')]/@for]"
      ],
      "password": [
        "//input[@id='PersonProfileFields.Password']",
        "//main[contains(@class, 'widget') and contains(@class, 'login')]//input[@name='password']"
      ],
      "verifyPassword": [
        "//input[@id='PersonProfileFields.Password_Confirm']",
        "//main[contains(@class, 'widget') and contains(@class, 'login')]//input[@name='password']"
      ],
      "endpoint": "/register",
      "saveStrategy": "onNextStep",
      "recaptchaXpath": [
        "//iframe[@title='reCAPTCHA']"
      ]
    },
    "contextData": {
      "classifier": {
        "applyBtnPath": [
          "//a[contains(@href, 'icims.com') and CONTAINS_TEXT('apply', true)]",
          "//a[contains(@href, 'icims.eu') and CONTAINS_TEXT('apply', true)]"
        ]
      },
      "options": {}
    },
    "entities": [
      [
        "resume",
        {
          "actions": [
            {
              "path": [
                ".//div[@id='PortalProfileFields.Resume_Content' and not(descendant::div[@id='PortalProfileFields.Resume_DeleteButtonSpan' and not(contains(@class, 'iCIMS_NoDisplay'))])]//input[@type='file' and contains(translate(@name, 'RESUME', 'resume'), 'resume')]"
              ],
              "method": "uploadResume",
              "options": {
                "resumeIsParsingXPath": [
                  ".//div[contains(@id, 'Resume_Loading') and not(contains(@class, 'NoDisplay'))]"
                ]
              }
            }
          ]
        }
      ],
      [
        "firstName",
        [
          ".//input[@autocomplete='given-name']",
          ".//input[contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'icims_f_firstname')]"
        ]
      ],
      [
        "lastName",
        [
          ".//input[@autocomplete='family-name']",
          ".//input[contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'icims_f_lastname')]"
        ]
      ],
      [
        "preferredFirstName",
        [
          "//input[@id='PersonProfileFields.FormerLastName']",
          "//input[@type='text' and @id = //label[CONTAINS_TEXT('preferred', true) and CONTAINS_TEXT('first', true) and CONTAINS_TEXT('name', true)]/@for]"
        ]
      ],
      [
        "email",
        {
          "actions": [
            {
              "path": [
                ".//input[@autocomplete='email']"
              ],
              "method": "setValue",
              "options": {
                "resetValue": true
              }
            }
          ]
        }
      ],
      [
        "phoneType",
        {
          "actions": [
            {
              "path": [
                ".//select[contains(@id, 'PersonProfileFields.PhoneType')]"
              ],
              "method": "clickOption",
              "values": {
                "mobile": [
                  "Mobile"
                ]
              }
            }
          ]
        }
      ],
      [
        "phone",
        [
          ".//input[@autocomplete='tel-national']"
        ]
      ],
      [
        "phoneCode",
        {
          "actions": [
            {
              "path": [
                "//input[@id='countryCode']/following-sibling::ul[contains(@class,'dropdown-results')]"
              ],
              "method": "click"
            },
            {
              "path": [
                "//input[contains(@name, 'countryCodeSearch')]"
              ],
              "method": "setValue",
              "defaultValue": "(+1) United States"
            },
            {
              "path": [
                "//input[@id='countryCode']/following-sibling::ul[contains(@class,'dropdown-results')]"
              ],
              "method": "clickOption",
              "options": {
                "defaultValue": "(+1) United States"
              }
            },
            {
              "path": [
                "//li[contains(@class,'dropdown-result') and @value='US' and .//strong[contains(normalize-space(.),'(+1) United States')]]"
              ],
              "method": "click"
            }
          ]
        },
        {
          "keywords": [
            "phone"
          ]
        }
      ],
      [
        "phoneStripped",
        {
          "actions": [
            {
              "path": [
                "//input[@id='icims_0_PhoneNumber']"
              ],
              "method": "setValue",
              "options": {
                "resetValue": true
              }
            }
          ]
        }
      ],
      [
        "addressType",
        {
          "actions": [
            {
              "path": [
                ".//select[contains(@id, 'PersonProfileFields.AddressType')]"
              ],
              "method": "clickOption",
              "values": {
                "home": [
                  "Home"
                ]
              }
            }
          ]
        }
      ],
      [
        "addressLine1",
        [
          ".//input[contains(@id, 'PersonProfileFields.AddressStreet1')]"
        ]
      ],
      [
        "city",
        [
          ".//input[contains(@id, 'PersonProfileFields.AddressCity')]"
        ]
      ],
      [
        "answerSource",
        {
          "actions": [
            {
              "path": [
                ".//select[contains(@data-label, 'How did you hear')]"
              ],
              "method": "clickOptionWithMultiAnswers",
              "values": {
                "source": [
                  "Other",
                  "Google"
                ]
              },
              "options": {
                "lowPriority": [
                  "Indeed",
                  "ZipRecruiter",
                  "LinkedIn",
                  "Glassdoor",
                  "Simplyhired",
                  "Dice",
                  "CareerBuilder",
                  "Monster"
                ],
                "prohibited": [
                  "referral",
                  "referred",
                  "connection",
                  "at the company",
                  "for the organization",
                  "employee",
                  "select",
                  "current worker"
                ],
                "ignoreFirst": true,
                "selectFirstExcludingProhibited": true
              }
            },
            {
              "path": [
                ".//select[contains(@aria-label, 'Please specify')]"
              ],
              "method": "clickOptionWithMultiAnswers",
              "values": {
                "source": [
                  "Other",
                  "Google",
                  "Not Applicable"
                ]
              },
              "options": {
                "lowPriority": [
                  "Indeed",
                  "ZipRecruiter",
                  "LinkedIn",
                  "Glassdoor",
                  "Simplyhired",
                  "Dice",
                  "CareerBuilder",
                  "Monster"
                ],
                "prohibited": [
                  "referral",
                  "referred",
                  "connection",
                  "at the company",
                  "for the organization",
                  "employee",
                  "select",
                  "current worker"
                ],
                "ignoreFirst": true,
                "selectFirstExcludingProhibited": true
              }
            },
            {
              "path": [
                ".//input[contains(@id, 'rcf3049_Text')]"
              ],
              "method": "setValue",
              "defaultValue": "Job Board",
              "options": {
                "triggerBlurEvent": false
              }
            }
          ]
        }
      ],
      [
        "postalCode",
        [
          ".//input[contains(@id, 'PersonProfileFields.AddressZip')]"
        ]
      ],
      [
        "country",
        [
          {
            "actions": [
              {
                "path": [
                  ".//select[contains(@id, 'PersonProfileFields.AddressCountry')]",
                  ".//a[contains(@id, 'PersonProfileFields.AddressCountry')]"
                ],
                "method": "click"
              },
              {
                "path": [
                  ".//input[contains(@aria-controls, 'PersonProfileFields.AddressCountry_dropdown-results')]",
                  ".//div[contains(@aria-owns, 'PersonProfileFields.AddressCountry_dropdown-results')]//input"
                ],
                "method": "setValue",
                "options": {
                  "triggerBlurEvent": false,
                  "triggerKeyUpEvent": true,
                  "triggerKeyDownEvent": true,
                  "waitForNetworkAfterInteraction": true
                },
                "time": 500
              },
              {
                "path": [
                  "//ul[contains(@id, 'PersonProfileFields.AddressCountry_dropdown-results')]"
                ],
                "options": {
                  "waitForNetworkBeforeInteraction": true,
                  "optionMatchAttribute": [
                    "aria-label",
                    "title"
                  ]
                },
                "method": "clickOptionAsync"
              }
            ]
          },
          {
            "path": [
              ".//select[@name='CandProfileFields.Origin']"
            ],
            "method": "clickOption"
          }
        ]
      ],
      [
        "stateName",
        {
          "actions": [
            {
              "path": [
                ".//a[contains(@id, 'PersonProfileFields.AddressState')]"
              ],
              "method": "click"
            },
            {
              "path": [
                ".//a[contains(@id, 'PersonProfileFields.AddressState_icimsDropdown') and not(contains(@aria-label, 'No states available'))]/parent::*//input[contains(@aria-controls, 'PersonProfileFields.AddressState_dropdown-results')]"
              ],
              "method": "setValue",
              "options": {
                "triggerBlurEvent": false,
                "triggerKeyUpEvent": true,
                "triggerKeyDownEvent": true,
                "waitForNetworkAfterInteraction": true
              },
              "time": 500
            },
            {
              "path": [
                ".//ul[contains(@id, 'PersonProfileFields.AddressState_dropdown-results')]"
              ],
              "method": "clickOptionAsync",
              "options": {
                "similarMatch": true,
                "waitForNetworkBeforeInteraction": true,
                "optionMatchAttribute": [
                  "aria-label",
                  "title"
                ]
              }
            }
          ]
        }
      ],
      [
        "county",
        {
          "actions": [
            {
              "path": [
                ".//input[@type='text' and contains(@id, 'AddressCounty')]"
              ],
              "method": "getCounty"
            },
            {
              "path": [
                ".//input[@type='text' and contains(@id, 'AddressCounty')]"
              ],
              "method": "setValue",
              "options": {
                "waitForNetworkBeforeInteraction": true
              }
            }
          ]
        }
      ],
      [
        "race",
        {
          "actions": [
            {
              "path": [
                ".//select[@id='CandProfileFields.Race']"
              ],
              "method": "clickOption",
              "values": {
                "Black or African American": [
                  "Black or African American",
                  "Black",
                  "African"
                ],
                "East Asian": [
                  "Asian (Not Hispanic or Latino)",
                  "Asian"
                ],
                "Hispanic or Latino": [
                  "Hispanic or Latino",
                  "Hispanic",
                  "Latin"
                ],
                "Southeast Asian": [
                  "Asian (Not Hispanic or Latino)",
                  "Asian"
                ],
                "South Asian": [
                  "Asian (Not Hispanic or Latino)",
                  "Asian"
                ],
                "Native Hawaiian or Other Pacific Islander": [
                  "Native Hawaiian or Other Pacific Islander",
                  "Native Hawaiian",
                  "Pacific Islander"
                ],
                "American Indian or Alaska Native": [
                  "American Indian",
                  "Alaskan Native",
                  "Native",
                  "Alaska"
                ],
                "White": [
                  "White (Not Hispanic or Latino)",
                  "White"
                ],
                "Two or More Races": [
                  "Two or More",
                  "Multiple"
                ],
                "Some Other Race": [
                  "Other",
                  "Opt Out",
                  "Decline"
                ],
                "Decline to Answer": [
                  "Opt Out",
                  "Decline",
                  "Prefer not"
                ],
                "": [
                  "Opt Out",
                  "Decline"
                ]
              }
            }
          ]
        }
      ],
      [
        "gender",
        [
          {
            "actions": [
              {
                "path": [
                  ".//select[@id='CandProfileFields.Gender']"
                ],
                "method": "clickOption",
                "values": {
                  "Male": [
                    "Male",
                    "Man"
                  ],
                  "Female": [
                    "Female",
                    "Woman"
                  ],
                  "I do not want to answer": [
                    "Decline",
                    "I don't wish",
                    "I do not wish",
                    "Prefer not",
                    "Opt Out"
                  ],
                  "": [
                    "Decline",
                    "I don't wish",
                    "I do not wish",
                    "Prefer not",
                    "Opt Out"
                  ]
                }
              }
            ]
          },
          {
            "actions": [
              {
                "path": [
                  "//input[@type='radio' and contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '__gender__')]"
                ],
                "method": "click"
              }
            ]
          }
        ]
      ],
      [
        "agreement",
        [
          {
            "actions": [
              {
                "path": [
                  "//input[@type='checkbox' and contains(@aria-label, 'Use this address anyway')]",
                  "//input[@type='checkbox' and contains(@id, 'addresses')]"
                ],
                "method": "clickMultiple",
                "options": {
                  "processOnErrorPersistent": true
                }
              }
            ]
          },
          {
            "actions": [
              {
                "path": [
                  "//input[@type='checkbox' and contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'icims_f') and contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '_signature')]",
                  "//input[@type='checkbox' and @id='accept_gdpr']"
                ],
                "method": "clickMultiple",
                "options": {
                  "checkElementVisibility": true
                }
              }
            ]
          },
          {
            "actions": [
              {
                "path": [
                  "//input[@type='checkbox' and contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'icims_f_signature1')]"
                ],
                "method": "clickMultiple",
                "options": {
                  "checkElementVisibility": true
                }
              }
            ]
          },
          {
            "actions": [
              {
                "path": [
                  "//form[contains(@class, 'iCIMS_FormMainStyle')]//input[@type='checkbox' and contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'icims_f_signature')]"
                ],
                "method": "clickMultiple",
                "options": {
                  "checkElementVisibility": false
                }
              }
            ]
          }
        ]
      ],
      [
        "nameInitials",
        [
          {
            "actions": [
              {
                "path": [
                  "//input[@type='text' and contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'icims_f_initials')]"
                ],
                "method": "setValueMultiple",
                "options": {
                  "checkElementVisibility": true
                }
              }
            ]
          }
        ]
      ],
      [
        "disability",
        {
          "actions": [
            {
              "path": [
                ".//select[@name='CandProfileFields.Disability']"
              ],
              "method": "clickOption",
              "values": {
                "true": [
                  "Yes ",
                  "Yes,",
                  "Yes",
                  "I have"
                ],
                "false": [
                  "No ",
                  "No,",
                  "No",
                  "I do not have",
                  "Prefer not"
                ],
                "": [
                  "Decline",
                  "No ",
                  "No",
                  "I don't wish",
                  "Prefer not"
                ]
              }
            }
          ]
        }
      ],
      [
        "veteran",
        {
          "actions": [
            {
              "path": [
                ".//select[@name='CandProfileFields.Veteran']"
              ],
              "method": "clickOption",
              "values": {
                "true": [
                  "Yes ",
                  "Yes,",
                  "Yes",
                  "I have"
                ],
                "false": [
                  "No ",
                  "No,",
                  "No",
                  "I do not have",
                  "Prefer not"
                ],
                "": [
                  "Decline",
                  "No ",
                  "No",
                  "I don't wish",
                  "Prefer not"
                ]
              }
            }
          ]
        }
      ],
      [
        "workAuth",
        [
          {
            "actions": [
              {
                "path": [
                  ".//label[CONTAINS_TEXT('authoriz')]//ancestor::div[contains(@class, 'iCIMS_TableRow')]//select",
                  ".//*[CONTAINS_TEXT('authoriz')]/descendant-or-self::*[position() < 8]/select",
                  ".//span[CONTAINS_TEXT('authoriz')]/parent::p"
                ],
                "method": "clickOption",
                "values": {
                  "true": [
                    "Yes"
                  ],
                  "false": [
                    "No"
                  ],
                  "": [
                    "Yes"
                  ]
                }
              }
            ]
          }
        ]
      ],
      [
        "sponsorship",
        [
          {
            "actions": [
              {
                "path": [
                  ".//label[CONTAINS_TEXT('sponsorship')]//ancestor::div[contains(@class, 'iCIMS_TableRow')]//select",
                  ".//*[CONTAINS_TEXT('sponsorship')]/descendant-or-self::*[position() < 8]/select",
                  ".//span[CONTAINS_TEXT('sponsorship')]/parent::p"
                ],
                "method": "clickOption",
                "values": {
                  "true": [
                    "Yes"
                  ],
                  "false": [
                    "No"
                  ],
                  "": [
                    "Yes"
                  ]
                }
              }
            ]
          }
        ]
      ],
      [
        "over18",
        [
          {
            "actions": [
              {
                "path": [
                  ".//label[CONTAINS_TEXT('18 years') or CONTAINS_TEXT('over 18')]//ancestor::div[contains(@class, 'iCIMS_TableRow')]//select",
                  ".//*[CONTAINS_TEXT('18 years') or CONTAINS_TEXT('over 18')]/descendant-or-self::*[position() < 8]/select",
                  ".//span[CONTAINS_TEXT('18 years') or CONTAINS_TEXT('over 18')]/parent::p"
                ],
                "method": "clickOption",
                "values": {
                  "true": [
                    "Yes"
                  ],
                  "false": [
                    "No"
                  ],
                  "": [
                    "Yes"
                  ]
                }
              }
            ]
          }
        ]
      ],
      [
        "minYearlySalaryDesired",
        [
          ".//input[contains(@id, 'CandProfileFields.Salary') and @type='text']"
        ]
      ],
      [
        "state",
        [
          {
            "actions": [
              {
                "path": [
                  ".//a[contains(@aria-label, 'state') and contains(@aria-label, 'live')]"
                ],
                "method": "click"
              },
              {
                "path": [
                  ".//a[contains(@aria-label, 'state') and contains(@aria-label, 'live')]/following-sibling::div[contains(@class, 'dropdown-container')]//input[@type='text']"
                ],
                "method": "setValue",
                "options": {
                  "triggerBlurEvent": false,
                  "triggerKeyUpEvent": true,
                  "triggerKeyDownEvent": true,
                  "waitForNetworkAfterInteraction": true
                },
                "time": 500
              },
              {
                "path": [
                  ".//a[contains(@aria-label, 'state') and contains(@aria-label, 'live')]/following-sibling::div[contains(@class, 'dropdown-container')]//ul[contains(@class, 'dropdown-results')]"
                ],
                "method": "clickOptionAsync",
                "options": {
                  "waitForNetworkBeforeInteraction": true,
                  "optionMatchAttribute": [
                    "aria-label",
                    "title"
                  ]
                }
              }
            ]
          },
          {
            "path": [
              ".//select[@name='CandProfileFields.Origin']"
            ],
            "method": "clickOption"
          }
        ]
      ],
      [
        "certification",
        {
          "initialAddButtonPath": [
            ".//input[@type='radio' and contains(@id, 'ProvideLicense_yes') and not(@checked)]"
          ],
          "addButtonPath": [
            ".//input[@type='submit' and contains(@data-group-loop, 'Licenses') and not(contains(@style, 'display:none')) and contains(@value, 'Show More')]",
            ".//div[contains(@class, 'iCIMS_CollectionButtonsRow') and not(contains(@class, 'iCIMS_NoDisplay'))]//a[contains(text(), 'Add More (Licenses and Certifications (Current and Eligible))')]",
            ".//input[@type='submit' and contains(@data-group-loop, 'Certifications') and not(contains(@style, 'display:none')) and contains(@value, 'Show More')]"
          ],
          "containerPath": [
            ".//div[contains(@data-group-loop-name, 'Licenses')][__indexPlusOne__]",
            ".//div[contains(@class, 'iCIMS_CollectionContainer') and .//span[contains(text(), 'Licenses and Certifications (Current and Eligible) (__indexPlusOne__)')]]",
            ".//div[contains(@data-group-loop-name, 'Certifications')][__indexPlusOne__]"
          ],
          "entities": [
            [
              "name",
              [
                ".//input[@type='text' and contains(@id, 'LicenseType')]"
              ]
            ],
            [
              "issueDateMonthText",
              {
                "actions": [
                  {
                    "path": [
                      ".//select[contains(@id, 'IssueDate') and contains(@id, '_Month')]"
                    ],
                    "method": "clickOption",
                    "values": {
                      "January": [
                        "Jan",
                        "January",
                        "01",
                        "1"
                      ],
                      "February": [
                        "Feb",
                        "February",
                        "02"
                      ],
                      "March": [
                        "Mar",
                        "March",
                        "03"
                      ],
                      "April": [
                        "Apr",
                        "April",
                        "04"
                      ],
                      "May": [
                        "May",
                        "05"
                      ],
                      "June": [
                        "Jun",
                        "June",
                        "06"
                      ],
                      "July": [
                        "Jul",
                        "July",
                        "07"
                      ],
                      "August": [
                        "Aug",
                        "August",
                        "08"
                      ],
                      "September": [
                        "Sep",
                        "September",
                        "09"
                      ],
                      "October": [
                        "Oct",
                        "October",
                        "10"
                      ],
                      "November": [
                        "Nov",
                        "November",
                        "11"
                      ],
                      "December": [
                        "Dec",
                        "December",
                        "12"
                      ]
                    }
                  }
                ]
              }
            ],
            [
              "issueDateDay",
              {
                "actions": [
                  {
                    "path": [
                      ".//select[contains(@id, 'IssueDate') and contains(@id, '_Date')]"
                    ],
                    "method": "clickOption",
                    "values": {
                      "": [
                        "1",
                        "01"
                      ]
                    }
                  }
                ]
              }
            ],
            [
              "issueDateYear",
              [
                ".//input[contains(@id, 'IssueDate') and contains(@id, '_Year')]"
              ]
            ]
          ]
        }
      ],
      [
        "experience",
        {
          "addButtonPath": [
            "(.//span[contains(@class, 'iCIMS_LabelText') and contains(., 'Experience')]//div[contains(@class, 'iCIMS_CollectionButtonsRow') and not(contains(@class, 'NoDisplay'))])[last()]//a[@role='button' and starts-with(., 'Add More')]",
            ".//a[CONTAINS_TEXT('add') and CONTAINS_TEXT('experience')]",
            ".//input[@type='submit' and contains(@value, 'Add More') and contains(@name, 'icims_gsi_Work_Experience')]",
            ".//input[@type='submit' and contains(@data-group-loop, 'Work_Exp') and not(contains(@style, 'display:none')) and contains(@value, 'Show More')]",
            ".//input[@type='submit' and contains(@data-group-loop, 'Employment') and not(contains(@style, 'display:none')) and contains(@value, 'Show More')]",
            ".//input[@type='submit' and contains(@data-group-loop, 'Work') and contains(@data-group-loop, 'Exp') and not(contains(@style, 'display:none')) and contains(@value, 'Show More')]",
            "//table[contains(@id, 'WorkExperience')]/ancestor::td//input[contains(@class, 'add')]"
          ],
          "containerPath": [
            "//span[contains(@class, 'iCIMS_LabelText') and contains(., 'Experience')]//ancestor::div[contains(@class, 'iCIMS_CollectionContainer') and not(contains(@class, 'NoDisplay')) and .//div[@data-index='__indexPlusOne__']]",
            ".//div[contains(@data-group-loop-name, 'Work_Exp')][__indexPlusOne__]",
            ".//div[contains(@data-group-loop-name, 'Employment')][__indexPlusOne__]",
            ".//div[contains(@data-group-loop-name, 'Work') and contains(@data-group-loop-name, 'Exp')][__indexPlusOne__]",
            "(//table[contains(@id, 'WorkExperience')]/ancestor::td//div[contains(@class, 'loop')])[__indexPlusOne__]",
            "//div[contains(@class, 'iCIMS_CollectionContainer')][.//legend/span[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'most') and contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'recent') and contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'experience')]][__indexPlusOne__]"
          ],
          "removeButtonPath": [
            ".//div[contains(@class, 'RemoveButton') and not(contains(@class, 'NoDisplay'))]//a"
          ],
          "options": {
            "ignoreExistingValue": true,
            "checkAddButtonVisibility": true,
            "skipSectionSubEntitiesCheck": true
          },
          "entities": [
            [
              "companyName",
              [
                ".//input[@type='text' and contains(@name, 'PersonProfileFields.rcf3212')]",
                ".//input[@type='text' and contains(@id, 'icims___index__EmpName5')]",
                ".//input[@type='text' and contains(@id, 'Emp') and contains(@id, 'Name')]",
                ".//input[@type='text' and contains(@id, 'Comp') and contains(@id, 'Name')]",
                ".//input[@type='text' and contains(@class, 'iCIMS_Forms_Qemp_name')]"
              ]
            ],
            [
              "title",
              {
                "actions": [
                  {
                    "path": [
                      ".//input[@type='text' and contains(@name, 'PersonProfileFields.rcf3213')]",
                      ".//input[@type='text' and contains(@id, '_YourTitle_')]",
                      ".//input[@type='text' and contains(@id, '_Emplyposition_')]",
                      ".//input[@type='text' and contains(@id, 'Emp') and contains(@id, 'Title')]",
                      ".//input[@type='text' and contains(@id, 'Job') and contains(@id, 'Title')]",
                      ".//input[@type='text' and contains(@class, 'iCIMS_Forms_Qemp_job_title')]"
                    ],
                    "method": "setValue",
                    "options": {
                      "removeSpecialChars": true
                    }
                  }
                ]
              }
            ],
            [
              "cityState",
              [
                ".//input[@type='text' and contains(@name, 'PersonProfileFields.rcf3264')]",
                ".//input[@type='text' and contains(@id, '_Address_')]"
              ]
            ],
            [
              "city",
              [
                ".//input[@type='text' and contains(@name, 'PersonProfileFields.rcf3216')]",
                ".//input[@type='text' and contains(@id, 'icims___index__EmpCity5')]",
                ".//input[@type='text' and contains(@id, '_City_')]",
                ".//input[@type='text' and contains(@class, 'iCIMS_Forms_Qemp_city')]",
                ".//input[@type='text' and contains(@id, 'Emp') and contains(@id, 'City')]",
                ".//input[@type='text' and contains(@id, 'Comp') and contains(@id, 'City')]"
              ]
            ],
            [
              "postalCode",
              {
                "actions": [
                  {
                    "path": [
                      ".//input[@type='text' and contains(@name, 'PersonProfileFields.rcf3265')]"
                    ],
                    "method": "setValue",
                    "options": {
                      "resetValue": true
                    }
                  }
                ]
              }
            ],
            [
              "country",
              [
                {
                  "actions": [
                    {
                      "path": [
                        ".//a[contains(@aria-label, 'Country') and contains(@id, 'PersonProfileFields')]",
                        ".//select[@id = //label[CONTAINS_TEXT('country', true)]/@for]"
                      ],
                      "method": "click"
                    },
                    {
                      "path": [
                        ".//a[contains(@aria-label, 'Country') and contains(@id, '-__indexPlusOne___PersonProfileFields') and not(contains(@aria-label, 'No states available'))]/parent::*//input[contains(@aria-controls, 'PersonProfileFields') and contains(@aria-controls, 'dropdown-results')]",
                        ".//a[contains(@aria-label, 'Country') and contains(@id, 'PersonProfileFields') and not(contains(@aria-label, 'No states available'))]/parent::*//input[contains(@aria-controls, 'PersonProfileFields') and contains(@aria-controls, 'dropdown-results')]",
                        ".//select[@id = //label[CONTAINS_TEXT('country', true) and not(contains(@aria-label, 'No states available'))]/@for]/parent::*//input[contains(@aria-controls, 'PersonProfileFields') and contains(@aria-controls, 'dropdown-results')]"
                      ],
                      "method": "setValue",
                      "time": 500,
                      "options": {
                        "triggerBlurEvent": false,
                        "triggerKeyUpEvent": true,
                        "triggerKeyDownEvent": true,
                        "waitForNetworkAfterInteraction": true
                      }
                    },
                    {
                      "path": [
                        ".//ul[contains(@id, 'PersonProfileFields') and contains(@id, 'dropdown-results')]"
                      ],
                      "method": "clickOptionAsync",
                      "options": {
                        "waitForNetworkBeforeInteraction": true,
                        "similarMatch": true,
                        "containerElement": "container",
                        "optionMatchAttribute": [
                          "aria-label",
                          "title"
                        ]
                      }
                    }
                  ]
                },
                {
                  "actions": [
                    {
                      "path": [
                        ".//select[contains(@id, 'Emp') and contains(@id, 'Country')]"
                      ],
                      "method": "clickOption"
                    }
                  ]
                }
              ]
            ],
            [
              "stateName",
              [
                {
                  "actions": [
                    {
                      "path": [
                        ".//a[contains(@id, '-__indexPlusOne___PersonProfileFields.rcf3217') and contains(@aria-Label, 'State')]",
                        ".//select[@id = //label[CONTAINS_TEXT('state', true)]/@for]"
                      ],
                      "method": "click"
                    },
                    {
                      "path": [
                        ".//a[contains(@id, '-__indexPlusOne___PersonProfileFields.rcf3217_icimsDropdown') and not(contains(@aria-label, 'No states available'))]/parent::*//input[contains(@aria-controls, 'PersonProfileFields.rcf3217_dropdown-results')]",
                        ".//select[@id = //label[CONTAINS_TEXT('state', true) and not(contains(@aria-label, 'No states available'))]/@for]/parent::*//input[contains(@aria-controls, 'dropdown-results')]"
                      ],
                      "method": "setValue",
                      "options": {
                        "triggerBlurEvent": false,
                        "triggerKeyUpEvent": true,
                        "triggerKeyDownEvent": true,
                        "waitForNetworkAfterInteraction": true
                      },
                      "time": 500
                    },
                    {
                      "path": [
                        ".//ul[contains(@id, '__indexPlusOne___PersonProfileFields.rcf3217_dropdown-results')]",
                        ".//select[@id = //label[CONTAINS_TEXT('state', true)]/@for]/parent::*//ul[contains(@id, 'PersonProfileFields') and contains(@id, 'dropdown-results')]"
                      ],
                      "method": "clickOptionAsync",
                      "options": {
                        "similarMatch": true,
                        "containerElement": "container",
                        "waitForNetworkBeforeInteraction": true,
                        "optionMatchAttribute": [
                          "aria-label",
                          "title"
                        ]
                      }
                    }
                  ]
                },
                {
                  "actions": [
                    {
                      "path": [
                        ".//select[contains(@class, 'iCIMS_Forms_Qemp_state')]",
                        ".//select[contains(@id, 'Emp') and contains(@id, 'State')]",
                        ".//select[contains(@id, 'Comp') and contains(@id, 'State')]"
                      ],
                      "method": "clickOption",
                      "options": {
                        "forceOptionSearch": true
                      }
                    }
                  ]
                }
              ]
            ],
            [
              "startDateMonthText",
              {
                "actions": [
                  {
                    "path": [
                      ".//select[contains(@id, 'PersonProfileFields.rcf3214_Month')]",
                      ".//select[contains(@id, 'icims__index__Emp5From_Month')]",
                      ".//select[contains(@id, 'StartDate') and contains(@id, '_Month')]"
                    ],
                    "method": "clickOption",
                    "values": {
                      "January": [
                        "Jan",
                        "January",
                        "01",
                        "1"
                      ],
                      "February": [
                        "Feb",
                        "February",
                        "02"
                      ],
                      "March": [
                        "Mar",
                        "March",
                        "03"
                      ],
                      "April": [
                        "Apr",
                        "April",
                        "04"
                      ],
                      "May": [
                        "May",
                        "05"
                      ],
                      "June": [
                        "Jun",
                        "June",
                        "06"
                      ],
                      "July": [
                        "Jul",
                        "July",
                        "07"
                      ],
                      "August": [
                        "Aug",
                        "August",
                        "08"
                      ],
                      "September": [
                        "Sep",
                        "September",
                        "09"
                      ],
                      "October": [
                        "Oct",
                        "October",
                        "10"
                      ],
                      "November": [
                        "Nov",
                        "November",
                        "11"
                      ],
                      "December": [
                        "Dec",
                        "December",
                        "12"
                      ]
                    }
                  }
                ]
              }
            ],
            [
              "startDateMonth",
              {
                "actions": [
                  {
                    "path": [
                      ".//label[CONTAINS_TEXT('start')]//ancestor::div[contains(@class, 'iCIMS_TableRow')]//select[contains(@name, '_Date')]",
                      ".//select[contains(@id, 'StartDate') and contains(@id, 'Month')]"
                    ],
                    "method": "clickOption"
                  }
                ]
              }
            ],
            [
              "startDateMonthAbbr",
              {
                "actions": [
                  {
                    "path": [
                      ".//select[contains(@id, 'PersonProfileFields.rcf3214_Month')]",
                      ".//select[contains(@id, 'From') and contains(@id, 'Month')]",
                      ".//select[contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'start') and contains(@class, 'iCIMS_Forms_MonthInput')]"
                    ],
                    "method": "clickOption"
                  }
                ]
              }
            ],
            [
              "startDateDay",
              {
                "actions": [
                  {
                    "path": [
                      ".//select[contains(@id, 'PersonProfileFields.rcf3214_Date')]",
                      ".//select[contains(@id, 'rcf3115_Date')]",
                      ".//select[contains(@id, 'icims__index__Emp5From_Date')]",
                      ".//select[contains(@id, 'StartDate') and contains(@class, 'iCIMS_Forms_DayInput')]",
                      ".//select[contains(@id, 'From') and contains(@class, 'iCIMS_Forms_DayInput')]",
                      ".//select[contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'start') and contains(@class, 'iCIMS_Forms_DayInput')]"
                    ],
                    "method": "clickOption",
                    "values": {
                      "": [
                        "1",
                        "01"
                      ]
                    }
                  }
                ]
              }
            ],
            [
              "startDateYear",
              [
                ".//input[@type='text' and contains(@name, 'PersonProfileFields.rcf3214_Year')]",
                ".//input[@type='text' and contains(@name, 'rcf3115_Year')]",
                ".//input[@type='text' and contains(@id, 'icims__index__Emp5From_Year')]",
                ".//input[contains(@id, 'StartDate') and contains(@id, 'Year')]",
                ".//input[contains(@id, 'From') and contains(@id, 'Year')]",
                ".//input[contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'start') and contains(@class, 'iCIMS_Forms_YearInput')]"
              ]
            ],
            [
              "endDateMonthText",
              {
                "actions": [
                  {
                    "path": [
                      ".//select[contains(@id, 'PersonProfileFields.rcf3215_Month')]",
                      ".//select[contains(@id, 'icims__index__Emp5To_Month')]",
                      ".//select[contains(@id, 'EndDate') and contains(@id, '_Month')]"
                    ],
                    "method": "clickOption",
                    "values": {
                      "January": [
                        "Jan",
                        "January",
                        "01"
                      ],
                      "February": [
                        "Feb",
                        "February",
                        "02"
                      ],
                      "March": [
                        "Mar",
                        "March",
                        "03"
                      ],
                      "April": [
                        "Apr",
                        "April",
                        "04"
                      ],
                      "May": [
                        "May",
                        "05"
                      ],
                      "June": [
                        "Jun",
                        "June",
                        "06"
                      ],
                      "July": [
                        "Jul",
                        "July",
                        "07"
                      ],
                      "August": [
                        "Aug",
                        "August",
                        "08"
                      ],
                      "September": [
                        "Sep",
                        "September",
                        "09"
                      ],
                      "October": [
                        "Oct",
                        "October",
                        "10"
                      ],
                      "November": [
                        "Nov",
                        "November",
                        "11"
                      ],
                      "December": [
                        "Dec",
                        "December",
                        "12"
                      ],
                      "": [
                        ""
                      ]
                    }
                  }
                ]
              }
            ],
            [
              "endDateMonth",
              {
                "actions": [
                  {
                    "path": [
                      ".//select[contains(@id, 'EndDate') and contains(@id, 'Month') and not(contains(@id, 'SchoolEndDate'))]"
                    ],
                    "method": "clickOption"
                  }
                ]
              }
            ],
            [
              "endDateMonthAbbr",
              {
                "actions": [
                  {
                    "path": [
                      ".//select[contains(@id, 'PersonProfileFields.rcf3215_Month')]",
                      ".//select[contains(@id, 'To') and contains(@id, 'Month') and not(contains(@id, 'SchoolEndDate'))]",
                      ".//select[contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'end') and contains(@class, 'iCIMS_Forms_MonthInput')]"
                    ],
                    "method": "clickOption",
                    "options": {
                      "saveAnsweredId": true
                    }
                  }
                ]
              }
            ],
            [
              "endDateDay",
              [
                {
                  "actions": [
                    {
                      "path": [
                        ".//select[contains(@id, 'PersonProfileFields.rcf3215_Date')]",
                        ".//select[contains(@id, 'EndDate') and contains(@class, 'iCIMS_Forms_DayInput')]",
                        ".//select[contains(@id, 'To') and contains(@class, 'iCIMS_Forms_DayInput')]",
                        ".//select[contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'end') and contains(@class, 'iCIMS_Forms_DayInput')]"
                      ],
                      "method": "clickOption",
                      "values": {
                        "": [
                          "0",
                          ""
                        ]
                      }
                    }
                  ]
                },
                {
                  "actions": [
                    {
                      "path": [
                        ".//select[contains(@id, 'EmpyTo') and contains(@class, 'iCIMS_Forms_DayInput')]"
                      ],
                      "method": "clickOption",
                      "values": {
                        "": [
                          "0",
                          ""
                        ]
                      },
                      "options": {
                        "saveAnsweredId": true
                      }
                    }
                  ]
                }
              ]
            ],
            [
              "endDateYear",
              [
                ".//input[@type='text' and contains(@name, 'PersonProfileFields.rcf3215_Year')]",
                ".//input[@type='text' and contains(@id, 'icims__index__Emp5To_Year')]",
                ".//input[contains(@id, 'EndDate') and contains(@id, 'Year') and not(contains(@id, 'SchoolEndDate'))]",
                ".//input[contains(@id, 'To') and contains(@id, 'Year') and not(contains(@id, 'SchoolEndDate'))]",
                ".//input[contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'end') and contains(@class, 'iCIMS_Forms_YearInput')]"
              ]
            ],
            [
              "description",
              [
                ".//textarea[contains(@id, 'PersonProfileFields.rcf3219')]",
                ".//textarea[contains(@id, 'Empyjob')]",
                ".//textarea[contains(@id, 'Emp') and contains(@id, 'Desc')]",
                ".//textarea[contains(@id, 'Duties')]"
              ],
              [
                ".//textarea[contains(@id, 'icims__index__Emp5Description')]"
              ]
            ],
            [
              "reasonLeaving",
              [
                ".//textarea[contains(@id, 'PersonProfileFields.rcf3268')]",
                ".//textarea[contains(@id, 'Reason')]",
                ".//textarea[contains(@class, 'iCIMS_Forms_Qemp_reason_left')]",
                ".//textarea[contains(@id, 'Emp') and contains(@id, 'Reas') and contains(@id, 'Leav')]"
              ],
              [
                ".//textarea[contains(@id, 'icims__index__Emp5ReasonLeaving')]"
              ]
            ]
          ]
        }
      ],
      [
        "education",
        {
          "initialAddButtonPath": [
            ".//input[@type='radio' and contains(@id, 'ProvideEducation_yes') and not(@checked)]"
          ],
          "addButtonPath": [
            "(.//span[contains(@class, 'iCIMS_LabelText') and contains(., 'Education')]//ancestor::div[contains(@class, 'iCIMS_CollectionContainer') and not(contains(@class, 'NoDisplay'))]//div[contains(@class, 'iCIMS_CollectionButtonsRow') and not(contains(@class, 'NoDisplay'))])//a[@role='button' and starts-with(., 'Add More') and not(CONTAINS_TEXT('additional'))]",
            "(.//span[contains(@class, 'iCIMS_LabelText') and contains(., 'Education')]//ancestor::div[contains(@class, 'iCIMS_CollectionContainer') and not(contains(@class, 'NoDisplay'))]//div[contains(@class, 'iCIMS_CollectionButtonsRow') and not(contains(@class, 'NoDisplay'))])[last()]//a[@role='button' and starts-with(., 'Add More')]",
            ".//input[@type='submit' and contains(@data-group-loop, 'Education') and not(contains(@style, 'display:none')) and contains(@value, 'Show More')]",
            ".//input[@type='submit' and contains(@data-group-loop, 'Education') and not(contains(@style, 'display:none')) and contains(@value, 'Add') and contains(@value, 'Education')]"
          ],
          "containerPath": [
            "(.//div[contains(@class, 'iCIMS_CollectionContainer CandProfileFields.Education') and contains(@class, '-Container')])[__indexPlusOne__]",
            "(.//span[contains(@class, 'iCIMS_LabelText') and contains(normalize-space(.), 'Education') and not(contains(normalize-space(.), 'Additional'))]//ancestor::div[contains(@class, 'iCIMS_CollectionContainer') and not(contains(@class, 'NoDisplay')) and not(parent::div[preceding-sibling::h2[contains(normalize-space(.), 'Additional Education')]])])[__indexPlusOne__]",
            ".//div[contains(@data-group-loop-name, 'Education')][__indexPlusOne__]"
          ],
          "removeButtonPath": [
            ".//div[contains(@class, 'RemoveButton') and not(contains(@class, 'NoDisplay'))]//a"
          ],
          "options": {
            "afterAddButtonAsyncDelay": 10000,
            "ignoreExistingValue": true,
            "checkAddButtonVisibility": true,
            "skipSectionSubEntitiesCheck": true
          },
          "entities": [
            [
              "name",
              [
                {
                  "actions": [
                    {
                      "path": [
                        ".//input[@type='text' and contains(@id, 'PersonProfileFields.rcf2027')]",
                        ".//input[@type='text' and contains(@class, 'iCIMS_Forms_Qedu_name')]",
                        ".//input[@type='text' and contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'otherschool')]"
                      ],
                      "method": "setValue"
                    }
                  ]
                },
                {
                  "actions": [
                    {
                      "path": [
                        ".//select[contains(@id, 'ProfileFields.School')]",
                        ".//a[contains(@id, 'CandProfileFields.School')]",
                        ".//select[@id = //label[CONTAINS_TEXT('school', true)]/@for]"
                      ],
                      "method": "click"
                    },
                    {
                      "path": [
                        ".//a[contains(@id, 'CandProfileFields.School_icimsDropdown')]/parent::*//input[contains(@aria-controls, 'CandProfileFields.School_dropdown-results')]",
                        ".//input[@type='text' and contains(@id, 'SchoolName')]",
                        ".//select[@id = //label[CONTAINS_TEXT('school', true)]/@for]/parent::*//input[contains(@aria-controls, 'dropdown-results')]"
                      ],
                      "method": "setValue",
                      "time": 1000,
                      "options": {
                        "triggerBlurEvent": false,
                        "triggerKeyUpEvent": true,
                        "triggerKeyDownEvent": true,
                        "waitForNetworkAfterInteraction": true,
                        "resetValue": true
                      }
                    },
                    {
                      "path": [
                        ".//ul[contains(@id, 'CandProfileFields.School_dropdown-results')]",
                        ".//select[@id = //label[CONTAINS_TEXT('school', true)]/@for]/parent::*//ul[contains(@id, 'PersonProfileFields') and contains(@id, 'dropdown-results')]"
                      ],
                      "method": "clickOptionAsync",
                      "options": {
                        "waitForNetworkBeforeInteraction": true,
                        "optionMatchAttribute": [
                          "aria-label",
                          "title"
                        ],
                        "similarMatch": true,
                        "noMatchesFallbackText": [
                          "Other",
                          "not listed"
                        ],
                        "resetSearch": true,
                        "containerElement": "container"
                      }
                    }
                  ]
                },
                {
                  "actions": [
                    {
                      "path": [
                        ".//input[@type='text' and contains(@id, 'School') and not(contains(@id, 'OtherSchool'))]"
                      ],
                      "method": "setValue",
                      "time": 1000
                    }
                  ]
                },
                {
                  "actions": [
                    {
                      "path": [
                        ".//select[contains(@id, 'CandProfileFields.School')]"
                      ],
                      "method": "clickOption",
                      "defaultValue": "Other School"
                    },
                    {
                      "path": [
                        ".//label[CONTAINS_TEXT('institution') or CONTAINS_TEXT('school') or CONTAINS_TEXT('college') or CONTAINS_TEXT('university')]//ancestor::div[contains(@class, 'iCIMS_TableRow')]//input[@type='text']"
                      ],
                      "method": "setValue"
                    }
                  ]
                },
                {
                  "actions": [
                    {
                      "path": [
                        ".//input[contains(@id, 'OtherSchool') and ancestor::div[contains(@class, 'iCIMS_CollectionContainer')][1][not(.//select[contains(@id, 'School')]/option[@selected='selected'])]]"
                      ],
                      "method": "setValue"
                    }
                  ]
                }
              ]
            ],
            [
              "degree",
              [
                {
                  "actions": [
                    {
                      "path": [
                        ".//a[contains(@id, 'CandProfileFields.Degree')]",
                        ".//a[contains(@id, 'PersonProfileFields.rcf2026')]"
                      ],
                      "method": "click",
                      "time": 300,
                      "options": {
                        "trackQuestion": true
                      }
                    },
                    {
                      "path": [
                        ".//ul[contains(@id, 'CandProfileFields.Degree_dropdown-results')]",
                        ".//ul[contains(@id, 'rcf2026_dropdown-results')]",
                        ".//select[contains(@id, 'EducationLevel')]",
                        ".//select[contains(@id, '_Degree')]"
                      ],
                      "method": "clickOption",
                      "options": {
                        "questionContainer": [],
                        "optionMatchAttribute": [
                          "aria-label",
                          "title"
                        ]
                      },
                      "values": {
                        "bachelor's": [
                          "B.S.",
                          "B.Sc",
                          "Bachelor",
                          "BS"
                        ],
                        "master's": [
                          "M.S.",
                          "M.Sc",
                          "Master",
                          "MS"
                        ],
                        "associate": [
                          "A.A.",
                          "Associate",
                          "AA"
                        ],
                        "highschool": [
                          "High School",
                          "Some High School",
                          "Other"
                        ],
                        "High School / GED": [
                          "High School",
                          "Some High School",
                          "Other"
                        ]
                      }
                    }
                  ]
                },
                {
                  "actions": [
                    {
                      "path": [
                        ".//input[@type='text' and contains(@class, 'iCIMS_Forms_Qedu_degree')]"
                      ],
                      "method": "setValue"
                    }
                  ]
                },
                {
                  "actions": [
                    {
                      "path": [
                        ".//select[@id = //label[CONTAINS_TEXT('degree', true)]/@for]"
                      ],
                      "method": "click",
                      "time": 300,
                      "options": {
                        "trackQuestion": true
                      }
                    },
                    {
                      "path": [
                        ".//select[@id = //label[CONTAINS_TEXT('degree', true)]/@for]/parent::*//input[contains(@aria-controls, 'dropdown-results')]"
                      ],
                      "method": "setValue",
                      "time": 1000,
                      "options": {
                        "triggerBlurEvent": false,
                        "triggerKeyUpEvent": true,
                        "triggerKeyDownEvent": true,
                        "waitForNetworkAfterInteraction": true,
                        "resetValue": true
                      }
                    },
                    {
                      "path": [
                        ".//select[@id = //label[CONTAINS_TEXT('degree', true)]/@for]/parent::*//ul[contains(@id, 'PersonProfileFields') and contains(@id, 'dropdown-results')]"
                      ],
                      "method": "clickOptionAsync",
                      "options": {
                        "waitForNetworkBeforeInteraction": true,
                        "optionMatchAttribute": [
                          "aria-label",
                          "title"
                        ],
                        "similarMatch": true,
                        "noMatchesFallbackText": "Other",
                        "resetSearch": true,
                        "containerElement": "container"
                      }
                    }
                  ]
                }
              ]
            ],
            [
              "major",
              [
                {
                  "actions": [
                    {
                      "path": [
                        ".//input[@type='text' and contains(@id, 'PersonProfileFields.rcf2029')]",
                        ".//input[@type='text' and contains(@class, 'iCIMS_Forms_Qedu_major')]",
                        ".//input[@type='text' and contains(@id, 'Major')]"
                      ],
                      "method": "setValue"
                    }
                  ]
                },
                {
                  "actions": [
                    {
                      "path": [
                        ".//a[contains(@id, 'CandProfileFields.Major')]",
                        ".//select[@id = //label[CONTAINS_TEXT('major', true)]/@for]"
                      ],
                      "method": "click"
                    },
                    {
                      "path": [
                        ".//a[contains(@id, 'CandProfileFields.Major_icimsDropdown') and not(contains(@aria-label, 'No states available'))]/parent::*//input[contains(@aria-controls, 'CandProfileFields.Major_dropdown-results')]",
                        ".//select[@id = //label[CONTAINS_TEXT('major', true) and not(contains(@aria-label, 'No states available'))]/@for]/parent::*//input[contains(@aria-controls, 'dropdown-results')]"
                      ],
                      "method": "setValue",
                      "time": 500,
                      "options": {
                        "triggerBlurEvent": false,
                        "triggerKeyUpEvent": true,
                        "triggerDownUpEvent": true,
                        "waitForNetworkAfterInteraction": true
                      }
                    },
                    {
                      "path": [
                        ".//ul[contains(@id, 'CandProfileFields.Major_dropdown-results')]",
                        ".//select[@id = //label[CONTAINS_TEXT('major', true) and not(contains(@aria-label, 'No states available'))]/@for]/parent::*//ul[contains(@id, 'PersonProfileFields') and contains(@id, 'dropdown-results')]"
                      ],
                      "method": "clickOptionAsync",
                      "options": {
                        "waitForNetworkBeforeInteraction": true,
                        "optionMatchAttribute": [
                          "aria-label",
                          "title"
                        ],
                        "filledVariantContainerXPath": [
                          ".//div[contains(@class, 'CandProfileFields.Education') and not(contains(@class, 'Container'))][.//a[contains(@id, 'CandProfileFields.Major')]]"
                        ],
                        "containerElement": "container"
                      }
                    }
                  ]
                },
                {
                  "actions": [
                    {
                      "path": [
                        ".//select[contains(@id, 'SchoolMajor')]"
                      ],
                      "method": "clickOption"
                    }
                  ]
                }
              ]
            ],
            [
              "endDate",
              {
                "actions": [
                  {
                    "path": [
                      ".//input[@type='text' and contains(@id, 'PersonProfileFields.rcf2011')]"
                    ],
                    "method": "setValue"
                  }
                ]
              }
            ],
            [
              "endDateMonth",
              {
                "actions": [
                  {
                    "path": [
                      ".//select[contains(@id, 'GraduationDate_Month')]",
                      ".//select[contains(@id, 'SchoolEndDate') and contains(@id, '_Month')]",
                      ".//select[@id = //label[CONTAINS_TEXT('month', true)]/@for]"
                    ],
                    "method": "clickOption",
                    "values": {
                      "1": [
                        "Jan",
                        "January",
                        "01"
                      ],
                      "2": [
                        "Feb",
                        "February",
                        "02"
                      ],
                      "3": [
                        "Mar",
                        "March",
                        "03"
                      ],
                      "4": [
                        "Apr",
                        "April",
                        "04"
                      ],
                      "5": [
                        "May",
                        "05"
                      ],
                      "6": [
                        "Jun",
                        "June",
                        "06"
                      ],
                      "7": [
                        "Jul",
                        "July",
                        "07"
                      ],
                      "8": [
                        "Aug",
                        "August",
                        "08"
                      ],
                      "9": [
                        "Sep",
                        "September",
                        "09"
                      ],
                      "10": [
                        "Oct",
                        "October",
                        "10"
                      ],
                      "11": [
                        "Nov",
                        "November",
                        "11"
                      ],
                      "12": [
                        "Dec",
                        "December",
                        "12"
                      ]
                    }
                  }
                ]
              }
            ],
            [
              "endDateDay",
              {
                "actions": [
                  {
                    "path": [
                      ".//select[contains(@id, 'GraduationDate_Date')]",
                      ".//select[contains(@id, 'SchoolEndDate') and contains(@id, '_Date')]",
                      ".//select[@id = //label[CONTAINS_TEXT('day', true)]/@for]"
                    ],
                    "method": "clickOption"
                  }
                ]
              }
            ],
            [
              "endDateYear",
              [
                ".//input[@type='text' and contains(@name, 'GraduationDate_Year')]",
                ".//input[@type='text' and contains(@id, 'SchoolEndDate') and contains(@id, '_Year')]",
                ".//input[@id = //label[CONTAINS_TEXT('year', true) and not(CONTAINS_TEXT('number', true))]/@for]"
              ]
            ],
            [
              "gpa",
              [
                ".//input[@type='text' and contains(@name, 'GPA')]"
              ]
            ],
            [
              "isGraduated",
              [
                {
                  "actions": [
                    {
                      "path": [
                        ".//select[contains(@id, 'IsGraduated')]",
                        ".//select[contains(@id, 'SchoolGraduated')]",
                        ".//select[contains(@class, 'iCIMS_Forms_Qedu_grad')]"
                      ],
                      "method": "clickOption",
                      "values": {
                        "true": [
                          "yes"
                        ],
                        "false": [
                          "no"
                        ]
                      }
                    }
                  ]
                },
                {
                  "actions": [
                    {
                      "path": [
                        ".//select[@id = //label[CONTAINS_TEXT('graduate', true)]/@for]"
                      ],
                      "method": "click"
                    },
                    {
                      "path": [
                        ".//select[@id = //label[CONTAINS_TEXT('graduate', true)]/@for]/parent::*//ul[contains(@id, 'PersonProfileFields') and contains(@id, 'dropdown-results')]"
                      ],
                      "method": "clickOption",
                      "values": {
                        "true": [
                          "yes"
                        ],
                        "false": [
                          "no"
                        ]
                      }
                    }
                  ]
                }
              ]
            ],
            [
              "yearsCompleted",
              [
                ".//input[@type='text' and contains(@name, 'YearsCompleted')]",
                ".//input[@type='text' and contains(@id, 'YearsCompleted')]",
                ".//input[@type='text' and contains(@class, 'iCIMS_Forms_Qedu_years_complete')]"
              ]
            ],
            [
              "country",
              [
                {
                  "actions": [
                    {
                      "path": [
                        ".//select[contains(@id, 'SchoolCountry')]",
                        ".//select[contains(@id, 'EducationCountry')]",
                        ".//select[contains(@class, 'iCIMS_Forms_Qedu_country')]"
                      ],
                      "method": "clickOption",
                      "values": {
                        "": [
                          "United States"
                        ]
                      }
                    }
                  ]
                },
                {
                  "actions": [
                    {
                      "path": [
                        ".//a[contains(@id, 'PersonProfileFields.rcf2042')]",
                        ".//a[contains(@id, 'EducationCountry')]"
                      ],
                      "method": "click"
                    },
                    {
                      "path": [
                        ".//a[contains(@id, 'rcf2042_icimsDropdown') and not(contains(@aria-label, 'No states available'))]/parent::*//input[contains(@aria-controls, 'rcf2042_dropdown-results')]",
                        ".//a[contains(@id, 'CandProfileFields.EducationCountry') and not(contains(@aria-label, 'No states available'))]/parent::*//input[contains(@aria-controls, 'CandProfileFields.EducationCountry_dropdown-results')]"
                      ],
                      "method": "setValue",
                      "time": 500,
                      "options": {
                        "triggerBlurEvent": false,
                        "triggerKeyUpEvent": true,
                        "triggerKeyDownEvent": true,
                        "waitForNetworkAfterInteraction": true
                      }
                    },
                    {
                      "path": [
                        "(.//ul[contains(@id, 'rcf2042_dropdown-results')])[__indexPlusOne__]",
                        "(.//ul[contains(@id, 'CandProfileFields.EducationCountry_dropdown-results')])[__indexPlusOne__]"
                      ],
                      "method": "clickOptionAsync",
                      "options": {
                        "waitForNetworkBeforeInteraction": true,
                        "optionMatchAttribute": [
                          "aria-label",
                          "title"
                        ]
                      }
                    }
                  ]
                }
              ]
            ],
            [
              "city",
              [
                ".//input[@type='text' and contains(@name, 'EducationCity')]",
                ".//input[@type='text' and contains(@id, 'SchoolCity')]",
                ".//input[@type='text' and contains(@id, 'PersonProfileFields.rcf2012')]",
                ".//input[@type='text' and contains(@class, 'iCIMS_Forms_Qedu_city')]"
              ]
            ],
            [
              "stateName",
              [
                {
                  "actions": [
                    {
                      "path": [
                        ".//a[contains(@id, 'CandProfileFields.EducationState')]",
                        ".//a[contains(@id, 'PersonProfileFields.rcf2013')]"
                      ],
                      "method": "click"
                    },
                    {
                      "path": [
                        ".//a[contains(@id, 'CandProfileFields.EducationState_icimsDropdown') and not(contains(@aria-label, 'No states available'))]/parent::*//input[contains(@aria-controls, 'CandProfileFields.EducationState_dropdown-results')]",
                        ".//a[contains(@id, 'rcf2013_icimsDropdown') and not(contains(@aria-label, 'No states available'))]/parent::*//input[contains(@aria-controls, 'rcf2013_dropdown-results')]"
                      ],
                      "method": "setValue",
                      "time": 500,
                      "options": {
                        "triggerBlurEvent": false,
                        "triggerKeyUpEvent": true,
                        "triggerKeyDownEvent": true,
                        "waitForNetworkAfterInteraction": true
                      }
                    },
                    {
                      "path": [
                        "(.//ul[contains(@id, 'CandProfileFields.EducationState_dropdown-results')])[__indexPlusOne__]",
                        "(.//ul[contains(@id, 'rcf2013_dropdown-results')])[__indexPlusOne__]"
                      ],
                      "method": "clickOptionAsync",
                      "options": {
                        "waitForNetworkBeforeInteraction": true,
                        "optionMatchAttribute": [
                          "aria-label",
                          "title"
                        ]
                      }
                    }
                  ]
                },
                {
                  "actions": [
                    {
                      "path": [
                        ".//select[contains(@id, 'SchoolState')]",
                        ".//select[contains(@id, 'EducationState')]",
                        ".//select[contains(@class, 'iCIMS_Forms_Qedu_state')]"
                      ],
                      "method": "clickOption"
                    }
                  ]
                }
              ]
            ],
            [
              "startDateMonthAbbr",
              {
                "actions": [
                  {
                    "path": [
                      ".//select[contains(@id, 'EducationStartDate_Month')]"
                    ],
                    "method": "clickOption"
                  }
                ]
              }
            ],
            [
              "startDateDay",
              {
                "actions": [
                  {
                    "path": [
                      ".//select[contains(@id, 'ProfileFields.EducationStartDate_Date')]",
                      ".//select[contains(@id, 'EducationStartDate') and contains(@id, '_Date')]"
                    ],
                    "method": "clickOption",
                    "values": {
                      "": [
                        "1",
                        "01"
                      ]
                    }
                  }
                ]
              }
            ],
            [
              "startDateYear",
              [
                ".//input[@type='text' and contains(@id, 'EducationStartDate_Year')]"
              ]
            ]
          ]
        }
      ],
      [
        "highestEducation.name",
        [
          {
            "actions": [
              {
                "path": [
                  "//div[contains(@class,'iCIMS_FieldRow')][.//label[contains(normalize-space(), 'School')]][.//select]//a"
                ],
                "method": "click",
                "time": 1000
              },
              {
                "path": [
                  "//div[contains(@class,'iCIMS_FieldRow')][.//label[contains(normalize-space(), 'School')]][.//select]//input"
                ],
                "method": "setValue",
                "options": {
                  "triggerBlurEvent": false,
                  "triggerKeyUpEvent": true,
                  "triggerKeyDownEvent": true,
                  "waitForNetworkAfterInteraction": true
                },
                "time": 500
              },
              {
                "path": [
                  "//div[contains(@class,'iCIMS_FieldRow')][.//label[contains(normalize-space(), 'School')]][.//select]//ul[contains(@class, 'dropdown-results')]"
                ],
                "method": "clickOptionAsync"
              },
              {
                "path": [
                  "//select[@id = //div[contains(@class, 'iCIMS_InfoField')]/label[CONTAINS_TEXT('university')]/@for and not(self::input[@type='text'])]"
                ],
                "method": "clickOption",
                "options": {
                  "optionMapper": true,
                  "maxSelectOptionsCount": 7000,
                  "optionMatchAttribute": [
                    "value"
                  ]
                }
              }
            ]
          }
        ]
      ],
      [
        "birthDay",
        [
          {
            "actions": [
              {
                "path": [
                  ".//a[contains(@aria-label, 'Birth Day')]"
                ],
                "method": "click"
              },
              {
                "path": [
                  ".//a[contains(@aria-label, 'Birth Day')]/following-sibling::div[contains(@class, 'dropdown-container')]//input[@type='text']"
                ],
                "method": "setValue",
                "options": {
                  "triggerBlurEvent": false,
                  "triggerKeyUpEvent": true,
                  "triggerKeyDownEvent": true,
                  "waitForNetworkAfterInteraction": true
                },
                "time": 500
              },
              {
                "path": [
                  ".//a[contains(@aria-label, 'Birth Day')]/following-sibling::div[contains(@class, 'dropdown-container')]//ul[contains(@class, 'dropdown-results')]"
                ],
                "method": "clickOptionAsync",
                "options": {
                  "waitForNetworkBeforeInteraction": true,
                  "optionMatchAttribute": [
                    "aria-label",
                    "title"
                  ]
                }
              }
            ]
          },
          {
            "path": [
              ".//select[@name='CandProfileFields.Origin']"
            ],
            "method": "clickOption"
          }
        ]
      ],
      [
        "startMonthAvailabilityString",
        {
          "actions": [
            {
              "path": [
                "//select[@id='rcf2037_Month']"
              ],
              "method": "clickOption"
            }
          ]
        }
      ],
      [
        "startDayAvailabilityString",
        {
          "actions": [
            {
              "path": [
                "//select[@id='rcf2037_Date' or @id='rcf3115_Date']",
                "//select[contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'icims_f_dateavailable_date')]",
                "//select[contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'icims_f_dateavailabletostart_date')]"
              ],
              "method": "clickOption",
              "options": {
                "optionMapper": true
              }
            }
          ]
        }
      ],
      [
        "startYearAvailabilityString",
        [
          "//input[@id='rcf2037_Year' or @id='rcf3115_Year']",
          "//input[@type='text' and contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'icims_f_dateavailable_year')]",
          "//input[@type='text' and contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'icims_f_dateavailabletostart_year')]"
        ]
      ],
      [
        "workStartDateFormatted.startDateMonthAbbr",
        {
          "actions": [
            {
              "path": [
                "//select[contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'icims_f_dateavailable_month')]",
                "//select[contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'icims_f_dateavailabletostart_month')]",
                "//select[@id='rcf3115_Month']"
              ],
              "method": "clickOption"
            }
          ]
        }
      ],
      [
        "fullName",
        {
          "actions": [
            {
              "path": [
                "//input[@type='text' and contains(@id, 'icims_f_Name')]",
                "//input[@type='text' and contains(@id, 'icims_f_FullName')]"
              ],
              "method": "setValue"
            }
          ]
        }
      ],
      [
        "currentDate.currentDateMonthAbbr",
        {
          "actions": [
            {
              "path": [
                "//select[contains(@id, 'icims_f_Date_Month')]"
              ],
              "method": "clickOption"
            }
          ]
        }
      ],
      [
        "currentDate.dayOfTheMonthNoZeroPad",
        {
          "actions": [
            {
              "path": [
                "//select[contains(@id, 'icims_f_Date_Date')]"
              ],
              "method": "clickOption"
            }
          ]
        }
      ],
      [
        "currentDate.currentDateYear",
        {
          "actions": [
            {
              "path": [
                "//input[@type='text' and contains(@id, 'icims_f_Date_Year')]"
              ],
              "method": "setValue"
            }
          ]
        }
      ],
      [
        "contactAgreement",
        {
          "actions": [
            {
              "path": [
                ".//div[contains(@class, 'FieldRow') and contains(normalize-space(), 'you consent to receive')]//a[@role='combobox']"
              ],
              "method": "click"
            },
            {
              "path": [
                ".//div[contains(@class, 'FieldRow') and contains(normalize-space(), 'you consent to receive') and contains(@id, .//div[contains(@class, 'FieldRow') and contains(normalize-space(), 'you consent to receive')]//a[@role='combobox']/@id)]//ul"
              ],
              "method": "clickOption",
              "values": {
                "true": [
                  "Yes"
                ],
                "false": [
                  "No"
                ]
              },
              "defaultValue": "true"
            }
          ]
        },
        {
          "keywords": [
            "consent to receive"
          ]
        }
      ]
    ],
    "sections": {
      "options": {
        "routeDetection": true
      },
      "section": [
        {
          "route": [
            "/login"
          ],
          "entities": [
            "email",
            "privacyAgreement",
            "agreement",
            "applyBtn",
            "refuseAddDevice",
            "phoneCode"
          ]
        },
        {
          "route": [
            "/eeo",
            "/questions"
          ],
          "entities": [
            "over18",
            "workAuth",
            "sponsorship",
            "gender",
            "race"
          ]
        },
        {
          "urlParams": [
            "form=Applicant_Diversity"
          ],
          "entities": [
            "gender",
            "disability"
          ]
        },
        {
          "urlParams": [
            "form=Voluntary_Self_Identification_Forms",
            "form=OFCCP_Forms_Packet",
            "form=Cand_Submission",
            "form=Custom_EEO_Forms",
            "form=EEO_",
            "selected=Voluntary_Self_Identification_of_Disability",
            "form=SRC_Complete_Application"
          ],
          "entities": [
            "fullName",
            "firstName",
            "lastName",
            "privacyAgreement",
            "agreement",
            "workAuth",
            "sponsorship",
            "currentDate.currentDateMonthAbbr",
            "currentDate.dayOfTheMonthNoZeroPad",
            "currentDate.currentDateYear",
            "education",
            "experience",
            "nameInitials"
          ]
        },
        {
          "urlParams": [
            "form=New_EEO_Person_Form_Public",
            "form=Applicant_Statement",
            "form=Driver_Portal",
            "form=Application_and_Consent",
            "form=App_Packet",
            "form=New_US_App",
            "form=Application_Acknowledgement",
            "form=Agreement_To_Arbitrate",
            "form=Application&"
          ],
          "entities": [
            "fullName",
            "privacyAgreement",
            "agreement",
            "race",
            "gender",
            "currentDate.currentDateMonthAbbr",
            "currentDate.dayOfTheMonthNoZeroPad",
            "currentDate.currentDateYear"
          ]
        },
        {
          "urlParams": [
            "form=Employment_Application"
          ],
          "entities": [
            "name",
            "experience",
            "education",
            "certification",
            "privacyAgreement",
            "agreement",
            "workStartDateFormatted.startDateMonthAbbr",
            "startDayAvailabilityString",
            "startYearAvailabilityString"
          ]
        }
      ]
    }
  },
  "jazzhr": {
    "atsName": "jazzhr",
    "urls": [
      "*://*.applytojob.com/apply/*"
    ],
    "urlsExclude": [],
    "questionsInSubmitPage": true,
    "submitButtonPaths": [
      ".//a[contains(@id, 'submit-resume')]",
      ".//input[contains(@id, 'submit-resume')]"
    ],
    "nextStepButtonPaths": [],
    "nextStepDynamicLoad": false,
    "formLoadingXPaths": [
      ".//div[@id='resumator-submit' and CONTAINS_TEXT('submitting')]"
    ],
    "formLoadingAfterSubmitClick": true,
    "validationCheckFormValidity": false,
    "validateUsingQuestionErrorSelectors": true,
    "validationErrorXPaths": [],
    "validationErrorPersistent": false,
    "errorBannerXPaths": [],
    "questionValidationErrorSelectors": [
      ".form-group.has-error",
      ".dv_error"
    ],
    "targetNodeXPath": [
      ".//div[@class='job-form-fields']",
      ".//div[@id='resumator-job-application']",
      ".//form[@id='form_submit_new_resume']"
    ],
    "targetFrameNodeXPath": [],
    "canJobBeAppliedXPaths": {
      "applyButton": [],
      "submitButton": "",
      "email": [],
      "next": []
    },
    "customQuestions": {
      "patterns": {
        "questionId": "",
        "innerSelectors": [],
        "selectInputTagName": "",
        "selectInputAttrName": "",
        "selectInputAttrValue": "",
        "radioGroupMatchQuerySelector": "",
        "fieldsetMatchQuerySelector": "",
        "maxLabelLevel": "",
        "radioGroupAttrName": "",
        "radioGroupAttrValue": "",
        "listboxTagName": ""
      },
      "selectors": {
        "question": "div.form-group:not(.none):not(#resumator-submit), div.resumator-field-wrapper:not(#resumator-message-required):not(#resumator-submit):not(#resumator-recaptcha)",
        "title": "h1",
        "subTitle": "h3",
        "label": "label:not(.checkbox), div.resumator-label",
        "legend": "legend",
        "roleOption": "[role='option']",
        "radioInput": "input[type='radio']",
        "monthInput": "input[aria-valuetext='MM'], input[type='month']",
        "dateInput": "input[aria-valuetext='DD']",
        "yearInput": "input[aria-valuetext='YYYY']",
        "checkbox": "input[type='checkbox']",
        "optionsSelector": "label.checkbox"
      },
      "xpaths": {
        "currentListItem": [],
        "listInputBackBtnText": [],
        "selectPopupXPath": [],
        "listBoxPopupXPath": [],
        "selectedItemListXPath": [],
        "requiredFieldXPath": [
          ".//div[contains(@class, 'form-group')][not(contains(@class, 'none'))][not(@id='resumator-submit')][label[.//i[contains(@class, 'asterisk')]]]",
          ".//div[contains(@class, 'resumator-field-wrapper')][div[contains(@class, 'resumator-label')][text()[contains(., '*')]]]"
        ],
        "targetNodeXPath": []
      },
      "ignoreQuestions": [],
      "ignoreContainerQuestions": [
        "//div[@id='sms-consent']",
        "//div[@id='resumator-eeo-new-veteran']",
        "//div[@id='resumator-new-disability-message']",
        "//div[contains(@class, 'form-group')][.//div[contains(@class, 'help-block')]]"
      ]
    },
    "jobXPaths": {
      "entities": [
        [
          "titleDisplay",
          [
            "//div[contains(@class, 'job-header')]//h1"
          ]
        ],
        [
          "originalCompanyName",
          []
        ],
        [
          "jobTypes",
          []
        ],
        [
          "postingDate",
          []
        ],
        [
          "url",
          []
        ],
        [
          "desc",
          []
        ],
        [
          "locationDisplay",
          [
            "//div[contains(@class, 'job-attributes')]//div[@title='Location']"
          ]
        ],
        [
          "location",
          []
        ]
      ]
    },
    "preApply": {
      "urls": [],
      "entities": [
        [
          "consent",
          {}
        ],
        [
          "phoneStrippedCountryCode",
          {}
        ],
        [
          "continueButton",
          {}
        ],
        [
          "chooseVerificationMethod",
          {}
        ],
        [
          "sendButton",
          {}
        ]
      ],
      "urlsExclude": []
    },
    "entities": [
      [
        "answerSource",
        []
      ],
      [
        "applyBtn",
        {}
      ],
      [
        "firstName",
        [
          ".//input[contains(@id, 'firstname-value') or contains(@name, 'firstname-value')]"
        ]
      ],
      [
        "lastName",
        [
          ".//input[contains(@id, 'lastname-value') or contains(@name, 'lastname-value')]"
        ]
      ],
      [
        "preferredFirstName",
        []
      ],
      [
        "legalFirstName",
        []
      ],
      [
        "legalLastName",
        []
      ],
      [
        "fullName",
        []
      ],
      [
        "email",
        [
          ".//input[contains(@id, 'email-value') or contains(@name, 'email-value')]"
        ]
      ],
      [
        "phone",
        [
          ".//input[contains(@id, 'phone-value') or contains(@name, 'phone-value')]"
        ]
      ],
      [
        "addressLine1",
        [
          ".//input[contains(@id, 'address-value') or contains(@name, 'address-value')]"
        ]
      ],
      [
        "recentExperience.companyName",
        []
      ],
      [
        "recentExperience.title",
        []
      ],
      [
        "city",
        [
          ".//input[contains(@id, 'city-value') or contains(@name, 'city-value')]"
        ]
      ],
      [
        "state",
        [
          ".//input[contains(@id, 'state-value') or contains(@name, 'state-value')]"
        ]
      ],
      [
        "stateName",
        []
      ],
      [
        "postalCode",
        [
          ".//input[contains(@id, 'postal-value') or contains(@name, 'postal-value')]"
        ]
      ],
      [
        "cityStateName",
        []
      ],
      [
        "country",
        []
      ],
      [
        "resume",
        [
          {
            "actions": [
              {
                "path": [
                  ".//a[contains(@class, 'resumator-resume-action') and contains(@id, 'choose-upload')]"
                ],
                "method": "click"
              },
              {
                "path": [
                  ".//div[@id='resumator-resume']//input[contains(@id, 'resume-value') or contains(@name, 'resume-value')]"
                ],
                "method": "uploadResume"
              }
            ]
          },
          {
            "actions": [
              {
                "path": [
                  ".//div[@id='resumator-resume'] //input[contains(@id, 'resumator-questionnaire-file')]"
                ],
                "method": "uploadResume"
              }
            ]
          }
        ]
      ],
      [
        "over18",
        {
          "actions": [
            {
              "path": [
                ".//select[contains(@id, 'over18-value') or contains(@name, 'over18-value')]"
              ],
              "method": "clickOption",
              "values": {
                "true": [
                  "Yes"
                ],
                "false": [
                  "No"
                ]
              }
            }
          ]
        }
      ],
      [
        "minYearlySalaryDesired",
        [
          ".//input[contains(@id, 'salary-value') or contains(@name, 'salary-value')]"
        ]
      ],
      [
        "workStartDateAvailabilityString",
        {
          "actions": [
            {
              "method": "setDateInput",
              "format": "MM/dd/yyyy",
              "fullDate": {
                "path": [
                  ".//input[contains(@id, 'start-value') or contains(@id, 'start-value')]"
                ],
                "format": "yyyy-MM-dd"
              }
            }
          ]
        }
      ],
      [
        "experience",
        {
          "addButtonPath": [
            ""
          ],
          "confirmAddedPath": [
            ""
          ],
          "containerPath": [
            ""
          ],
          "entities": [
            [
              "companyName",
              []
            ],
            [
              "city",
              []
            ],
            [
              "state",
              []
            ],
            [
              "title",
              []
            ],
            [
              "cityState",
              []
            ],
            [
              "isCurrent",
              []
            ],
            [
              "startDate",
              []
            ],
            [
              "endDate",
              []
            ],
            [
              "description",
              []
            ]
          ]
        }
      ],
      [
        "weekdaysAvailability",
        {}
      ],
      [
        "weekendsAvailability",
        {
          "actions": [
            {
              "path": [
                ".//select[contains(@id, 'weekends-value') or contains(@name, 'weekends-value')]"
              ],
              "method": "clickOption",
              "values": {
                "true": [
                  "Yes"
                ],
                "false": [
                  "No"
                ]
              }
            }
          ]
        }
      ],
      [
        "openSchedule",
        {}
      ],
      [
        "flexibleSchedule",
        {}
      ],
      [
        "dayShift",
        {}
      ],
      [
        "nightShift",
        {}
      ],
      [
        "swingShift",
        {}
      ],
      [
        "overnightShift",
        {}
      ],
      [
        "anyShift",
        {}
      ],
      [
        "highestEducationLevel",
        []
      ],
      [
        "education",
        {
          "addButtonPath": [],
          "confirmAddedPath": [],
          "containerPath": [],
          "entities": [
            [
              "name",
              []
            ],
            [
              "degree",
              []
            ],
            [
              "major",
              []
            ],
            [
              "startDateMonth_MM",
              []
            ],
            [
              "endDateMonth_MM",
              []
            ],
            [
              "startDateMonthText",
              []
            ],
            [
              "endDateMonthText",
              []
            ],
            [
              "startDateYear",
              []
            ],
            [
              "endDateYear",
              []
            ],
            [
              "city",
              []
            ],
            [
              "state",
              []
            ]
          ]
        }
      ],
      [
        "workAuth",
        []
      ],
      [
        "agreement",
        {}
      ],
      [
        "sponsorship",
        {}
      ],
      [
        "lift50PoundsWeightAbility",
        {}
      ],
      [
        "gender",
        {
          "actions": [
            {
              "path": [
                ".//select[contains(@id, 'gender-value') or contains(@id, 'gender-value')]"
              ],
              "method": "clickOption",
              "values": {
                "Male": [
                  "Male",
                  "Man"
                ],
                "Female": [
                  "Female",
                  "Woman"
                ],
                "I do not want to answer": [
                  "Decline",
                  "I don't wish",
                  "Prefer not"
                ],
                "": [
                  "Decline",
                  "I don't wish",
                  "Prefer not"
                ]
              }
            }
          ]
        }
      ],
      [
        "hispanicLatino",
        {}
      ],
      [
        "genderPronouns",
        {}
      ],
      [
        "transgender",
        {}
      ],
      [
        "race",
        {
          "actions": [
            {
              "path": [
                ".//select[contains(@id, 'race-value') or contains(@id, 'race-value')]"
              ],
              "method": "clickOption",
              "values": {
                "Black or African American": [
                  "Black",
                  "African"
                ],
                "East Asian": [
                  "East Asian",
                  "Asian"
                ],
                "Hispanic or Latino": "Hispanic",
                "Southeast Asian": [
                  "Southeast Asian",
                  "Asian"
                ],
                "South Asian": [
                  "South Asian",
                  "Asian"
                ],
                "Native Hawaiian or Other Pacific Islander": [
                  "Native Hawaiian",
                  "Pacific Islander"
                ],
                "American Indian or Alaska Native": [
                  "American Indian",
                  "Alaskan Native"
                ],
                "White": "White",
                "Two or More Races": "Two or More",
                "Some Other Race": [
                  "Other",
                  "Decline"
                ],
                "Decline to Answer": [
                  "Decline",
                  "Prefer not"
                ],
                "": [
                  "Decline"
                ]
              }
            }
          ]
        }
      ],
      [
        "veteran",
        {
          "actions": [
            {
              "path": [
                ".//div[contains(@id, 'veteran-field')]"
              ],
              "method": "clickOption",
              "values": {
                "true": [
                  "I am a ",
                  "I identify ",
                  "Yes"
                ],
                "false": [
                  "I am not a ",
                  "I don't ",
                  "No",
                  "Prefer not"
                ],
                "": [
                  "Decline",
                  "I am not a ",
                  "I don't ",
                  "No",
                  "Prefer not"
                ]
              }
            }
          ]
        }
      ],
      [
        "disability",
        {
          "actions": [
            {
              "path": [
                ".//div[@id='disability-input-area']"
              ],
              "method": "clickOption",
              "values": {
                "true": [
                  "Yes",
                  "I have"
                ],
                "false": [
                  "No",
                  "I do not have",
                  "Prefer not"
                ],
                "": [
                  "Decline",
                  "I don't wish",
                  "Prefer not",
                  "No"
                ]
              }
            },
            {
              "path": [
                ".//input[contains(@id, 'disability_signature-value') or contains(@name, 'disability_signature-value')]"
              ],
              "method": "setValue",
              "userDataParam": "__fullName__"
            }
          ]
        }
      ],
      [
        "sexualOrientation",
        {}
      ],
      [
        "github",
        []
      ],
      [
        "twitter",
        []
      ],
      [
        "behance",
        []
      ],
      [
        "countryName",
        []
      ],
      [
        "phoneStripped",
        []
      ],
      [
        "phoneCode",
        []
      ],
      [
        "deviceType",
        {}
      ],
      [
        "certification",
        {
          "addButtonPath": [],
          "confirmAddedPath": [],
          "containerPath": [],
          "entities": [
            [
              "name",
              []
            ],
            [
              "issueDateSlashes_MMDDYYYY",
              []
            ]
          ]
        }
      ],
      [
        "skill",
        {
          "containerPath": [],
          "entities": [
            [
              "name",
              []
            ]
          ],
          "options": {
            "clickOutsideAtEnd": false
          }
        }
      ],
      [
        "lgbt",
        {}
      ],
      [
        "armedForces",
        {}
      ],
      [
        "currentDate.dateString",
        {
          "actions": [
            {
              "method": "setDateInput",
              "format": "MM/dd/yyyy",
              "fullDate": {
                "path": [
                  ".//input[contains(@id, 'disability_date-value') or contains(@name, 'disability_date-value')]"
                ],
                "format": "yyyy-MM-dd"
              }
            }
          ]
        }
      ],
      [
        "currentDateDashes",
        {}
      ],
      [
        "language",
        {}
      ],
      [
        "privacyAgreement",
        {}
      ],
      [
        "middleName",
        {}
      ],
      [
        "street",
        []
      ],
      [
        "cityLocated",
        []
      ],
      [
        "phoneType",
        {}
      ],
      [
        "phoneFormatted",
        []
      ],
      [
        "homePhoneFormatted",
        []
      ],
      [
        "referral",
        {}
      ],
      [
        "applyDate",
        {}
      ],
      [
        "birthMonth",
        {}
      ],
      [
        "birthDay",
        {}
      ],
      [
        "birthYear",
        {}
      ],
      [
        "addressType",
        {}
      ],
      [
        "startMonthAvailabilityString",
        {}
      ],
      [
        "startDayAvailabilityString",
        {}
      ],
      [
        "startYearAvailabilityString",
        []
      ],
      [
        "county",
        {}
      ],
      [
        "nameInitials",
        []
      ],
      [
        "addressLine2",
        []
      ],
      [
        "highestEducation.name",
        []
      ],
      [
        "highestEducation.degreeDisplay",
        []
      ],
      [
        "workStartDateAvailability",
        []
      ],
      [
        "currencyType",
        {}
      ],
      [
        "willingToWorkHolidays",
        {}
      ],
      [
        "employmentInvoluntarilyTerminated",
        {}
      ],
      [
        "startMonthNameAvailabilityString",
        {}
      ],
      [
        "cityState",
        {}
      ]
    ],
    "globalOptions": {
      "waitForAllRequestsBeforeFillingStep": false
    },
    "signIn": {
      "urls": [],
      "formPath": [],
      "submitButton": [],
      "toSignInButton": [],
      "createAccount": [],
      "forgotPassword": [],
      "email": [],
      "password": [],
      "errorMessage": [],
      "endpoint": "",
      "verifyPassword": [],
      "isInlineForm": false,
      "isEmailRequired": false,
      "errorPersistAfterReload": false
    },
    "signUp": {
      "errorMessage": [],
      "submitButton": [],
      "formStepPath": [],
      "email": [],
      "password": [],
      "verifyPassword": [],
      "endpoint": "",
      "saveStrategy": "",
      "urls": [],
      "verifyEmail": [],
      "userName": []
    },
    "nextStepButtonFallbackToParentFrame": false,
    "confirmSubmittedForm": {
      "confirmMessageXPath": [],
      "urls": []
    },
    "attachedContainer": [],
    "alwaysSyncWindowId": false,
    "screenshot": {
      "hide": [
        "div[id='tracking-consent-banner']"
      ]
    }
  },
  "jobvite": {
    "atsName": "jobvite",
    "urls": [
      "*://jobs.jobvite.com/*/apply*"
    ],
    "urlsExclude": [
      "*://jobs.jobvite.com/*/applyConfirmation*",
      "*://jobs.jobvite.com/*/duplicateApplication*"
    ],
    "submitButtonPaths": [
      ".//button[@type='submit' and not(contains(@class, 'ng-hide')) and @aria-label='Send Application']",
      ".//button[@type='submit' and not(contains(@class, 'ng-hide')) and contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'send') and contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'application')]"
    ],
    "jobIdExtractPatterns": [
      "jobs\\.jobvite\\.com\\/[^\\/]+\\/job\\/([a-zA-Z0-9]+)"
    ],
    "questionsInSubmitPage": true,
    "nextStepButtonPaths": [
      ".//button[contains(@class, 'jv-button-primary') and contains(@aria-label, 'Next')]",
      ".//button[@type='button' and contains(@class, 'jv-button-primary') and @ng-click='nextStep()']",
      ".//button[@type='submit' and contains(@class, 'jv-button-primary') and not(contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'send')) and not(contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'application'))]",
      ".//button[@type='submit' and @ng-disabled='submitting' and contains(@class, 'jv-button-primary') and not(contains(@class, 'ng-hide')) and contains(@aria-label, 'Next')]"
    ],
    "nextStepDynamicLoad": true,
    "validationErrorXPaths": [
      ".//div[@ng-show='!resumeName' and not(contains(@class, 'ng-hide'))]//div[@ng-if='errors.resume && !applyWithErrors.resumeUpload']//span[@aria-alert='true' and contains(@class, 'jv-form-error')]",
      ".//span[@aria-alert='true' and contains(@class, 'jv-form-error')]",
      "//p[@ng-if='applyWithErrors.resumeUpload']"
    ],
    "errorBannerXPaths": [],
    "targetNodeXPath": [
      ".//div[contains(@class, 'jv-form') and contains(@class, 'jv-apply-form')]",
      ".//form[contains(@class, 'jv-form') and contains(@name, 'consentForm')]",
      ".//article[contains(@class, 'jv-page-body')]"
    ],
    "targetFrameNodeXPath": [
      ".//div[@class='jv-page-container']"
    ],
    "questionValidationErrorSelectors": [
      "input[class*='ng-invalid'], textarea[class*='ng-invalid'], input[class*='ng-invalid'], select[class*='ng-invalid']"
    ],
    "canJobBeAppliedXPaths": {
      "applyButton": [
        ".//a[contains(@class, 'jv-button-primary') and contains(@class, 'jv-button-apply')]",
        ".//a[contains(@class, 'jv-button') and contains(@href, '/apply')]"
      ]
    },
    "customQuestions": {
      "patterns": {
        "questionId": "",
        "innerSelectors": [],
        "maxLabelLevel": ""
      },
      "selectors": {
        "title": "h1",
        "label": "label[for]",
        "legend": "legend",
        "ariaLabelledBy": "label",
        "roleOption": "[role='option']",
        "radioInput": "input[type='radio']",
        "monthInput": "input[aria-valuetext='MM']",
        "dateInput": "input[aria-valuetext='DD']",
        "yearInput": "input[aria-valuetext='YYYY']",
        "checkbox": "input[type='checkbox']",
        "question": "fieldset[ng-switch-when='radio'], fieldset[ng-switch-when='checkbox'], input[id^='jv-field']",
        "subTitle": "h2, h3, h4"
      },
      "xpaths": {
        "currentListItem": [],
        "listInputBackBtnText": [],
        "selectPopupXPath": [],
        "listBoxPopupXPath": [],
        "selectedItemListXPath": [],
        "targetNodeXPath": [],
        "requiredFieldXPath": [
          ".//span[contains(@class, 'jv-required-label')]",
          ".//span[CONTAINS_TEXT('*', true)]"
        ]
      },
      "ignoreQuestions": [],
      "ignoreContainerQuestions": [
        ".//footer[contains(@class, 'jv-footer')]"
      ]
    },
    "jobXPaths": {
      "entities": [
        [
          "titleDisplay",
          [
            ".//h2[contains(@class, 'jv-header')]"
          ]
        ],
        [
          "originalCompanyName",
          [
            ".//header//h1[contains(@class, 'jv-logo')]/a/img/@alt",
            ".//header//h1[contains(@class, 'jv-logo')]/a"
          ]
        ],
        [
          "jobTypes",
          []
        ],
        [
          "postingDate",
          []
        ],
        [
          "url",
          []
        ],
        [
          "desc",
          [
            ".//div[contains(@class, 'jv-job-detail-description')]"
          ]
        ],
        [
          "locationDisplay",
          [
            ".//h3[contains(@class, 'jv-job-detail-location')]",
            ".//h2[contains(@class, 'jv-header')]/following-sibling::p/span[contains(@class, 'jv-inline-separator')]/following-sibling::text()",
            ".//h2[contains(@class, 'jv-header')]/following-sibling::p"
          ]
        ]
      ]
    },
    "preApply": {
      "urls": [
        "*://jobs.jobvite.com/*/job/*"
      ],
      "urlsExclude": [],
      "entities": [
        [
          "applyBtn",
          {
            "actions": [
              {
                "key": "canJobBeAppliedXPaths.applyButton",
                "method": "click"
              }
            ]
          }
        ]
      ]
    },
    "sections": {
      "path": [
        "//div[contains(@class, 'jv-wrapper')]//h3[not(@id='jv-resume-header')]"
      ],
      "section": [
        {
          "title": [
            "Personal Information",
            "Profile",
            "Experience"
          ],
          "entities": [
            "firstName",
            "lastName",
            "email",
            "phoneFormatted",
            "phoneStripped",
            "preferredFirstName",
            "legalFirstName",
            "legalLastName",
            "fullName",
            "addressLine1",
            "addressLine2",
            "gender",
            "postalCode",
            "recentExperience.startDate",
            "recentExperience.endDate",
            "recentExperience.title",
            "state",
            "stateName",
            "city",
            "cityStateName",
            "country",
            "birthDate",
            "resume",
            "experience",
            "companyName",
            "startDate",
            "endDate",
            "title",
            "workAuth",
            "sponsorship",
            "startDateMonth_comma_YYYY",
            "endDateMonth_comma_YYYY",
            "workStartDateAvailabilityString",
            "minYearlySalaryDesired",
            "workStartDateFormatted.startDateDashes_YYYYMMDD",
            "highestEducation.degreeDisplay",
            "highestEducation.name",
            "agreement",
            "answerSource"
          ]
        },
        {
          "title": [
            "Identification"
          ],
          "entities": [
            "gender",
            "hispanicLatino",
            "race",
            "veteran",
            "name",
            "disability",
            "currentDate.dateString",
            "currentDateDashes"
          ]
        },
        {
          "title": [
            "Data Consent"
          ],
          "entities": [
            "country"
          ]
        },
        {
          "title": [
            "Screening Questions"
          ],
          "entities": [
            "workAuth",
            "sponsorship",
            "over18",
            "education",
            "certification",
            "name",
            "issueDate",
            "agreement"
          ]
        }
      ]
    },
    "entities": [
      [
        "firstName",
        [
          ".//input[@autocomplete='given-name']"
        ]
      ],
      [
        "lastName",
        [
          ".//input[@autocomplete='family-name']"
        ]
      ],
      [
        "preferredFirstName",
        [
          ".//input[@autocomplete='family-name']"
        ]
      ],
      [
        "legalFirstName",
        []
      ],
      [
        "legalLastName",
        []
      ],
      [
        "nameInitials",
        [
          "//input[@type='text' and @id = //label[CONTAINS_TEXT('by initialing')]/@for]"
        ]
      ],
      [
        "fullName",
        []
      ],
      [
        "email",
        [
          ".//input[@autocomplete='email']"
        ]
      ],
      [
        "phone",
        []
      ],
      [
        "addressLine1",
        [
          ".//input[@autocomplete='address-line1']"
        ]
      ],
      [
        "recentExperience.companyName",
        []
      ],
      [
        "recentExperience.startDate",
        [
          {
            "actions": [
              {
                "method": "setDateInput",
                "format": "MM/yyyy",
                "fullDate": {
                  "path": [
                    "//input[@id = //label[CONTAINS_TEXT('date') and CONTAINS_TEXT('started')]/@for]"
                  ],
                  "format": "yyyy-MM-dd"
                }
              }
            ]
          }
        ]
      ],
      [
        "recentExperience.endDate",
        [
          {
            "actions": [
              {
                "method": "setDateInput",
                "format": "MM/yyyy",
                "fullDate": {
                  "path": [
                    "//input[@id = //label[CONTAINS_TEXT('date') and CONTAINS_TEXT('left')]/@for]"
                  ],
                  "format": "yyyy-MM-dd"
                }
              }
            ]
          }
        ]
      ],
      [
        "recentExperience.title",
        []
      ],
      [
        "state",
        []
      ],
      [
        "stateName",
        [
          {
            "actions": [
              {
                "path": [
                  ".//select[@autocomplete='address-level1']"
                ],
                "method": "clickOption"
              }
            ]
          }
        ]
      ],
      [
        "postalCode",
        [
          ".//input[@autocomplete='postal-code']"
        ]
      ],
      [
        "city",
        [
          ".//input[@autocomplete='address-level2']"
        ]
      ],
      [
        "cityStateName",
        []
      ],
      [
        "country",
        [
          {
            "actions": [
              {
                "path": [
                  ".//select[@autocomplete='country-name']"
                ],
                "method": "clickOption"
              }
            ]
          },
          {
            "actions": [
              {
                "path": [
                  "//select[@id='jv-country-select']",
                  "//div[./fieldset/legend[contains(text(), 'Please select your answer.')]][preceding::p/span[contains(text(), 'primary residence in the United States')]]"
                ],
                "method": "clickOption",
                "options": {
                  "optionMapper": true
                },
                "values": {
                  "English": [
                    "United States"
                  ],
                  "united states": [
                    "Yes",
                    "All Countries",
                    "Global",
                    "Other"
                  ]
                }
              }
            ]
          }
        ]
      ],
      [
        "birthDate",
        [
          {
            "actions": [
              {
                "method": "setDateInput",
                "format": "MM/dd/yyyy",
                "fullDate": {
                  "path": [
                    "//input[@id = //label[CONTAINS_TEXT('date') and CONTAINS_TEXT('birth')]/@for]"
                  ],
                  "format": "yyyy-MM-dd"
                }
              }
            ]
          }
        ]
      ],
      [
        "education",
        {}
      ],
      [
        "experience",
        {
          "addButtonPath": [],
          "confirmAddedPath": [],
          "containerPath": [
            ".//h4[contains(@class, 'jv-prescreen-section-header') and CONTAINS_TEXT('present') and CONTAINS_TEXT('employer')]/parent::div[@ng-form='section.form']",
            "//div[@class='jv-form jv-apply-form' and .//div[@ng-repeat='field in applyFields' and @jv-apply-field='field'] and .//label[contains(text(), 'Company Name')]]"
          ],
          "entities": [
            [
              "companyName",
              [
                {
                  "actions": [
                    {
                      "path": [
                        "(//input[@id = //label[CONTAINS_TEXT('company') and CONTAINS_TEXT('name')]/@for])[__indexPlusOne__]"
                      ],
                      "method": "setValue"
                    }
                  ]
                }
              ]
            ],
            [
              "startDate",
              {
                "actions": [
                  {
                    "method": "setDateInput",
                    "format": "MM/yyyy",
                    "fullDate": {
                      "path": [
                        "(//input[@id = //label[CONTAINS_TEXT('start') and CONTAINS_TEXT('date')]/@for])[__indexPlusOne__]"
                      ],
                      "format": "yyyy-MM-dd"
                    }
                  }
                ]
              }
            ],
            [
              "endDate",
              {
                "actions": [
                  {
                    "method": "setDateInput",
                    "format": "MM/yyyy",
                    "fullDate": {
                      "path": [
                        "(//input[@id = //label[CONTAINS_TEXT('end') and CONTAINS_TEXT('date')]/@for])[__indexPlusOne__]"
                      ],
                      "format": "yyyy-MM-dd"
                    }
                  }
                ]
              }
            ],
            [
              "title",
              [
                {
                  "actions": [
                    {
                      "path": [
                        "(//input[@id = //label[CONTAINS_TEXT('title')]/@for])[__indexPlusOne__]"
                      ],
                      "method": "setValue"
                    }
                  ]
                }
              ]
            ],
            [
              "startDateMonth_comma_YYYY",
              {
                "actions": [
                  {
                    "path": [
                      "((//p[span[contains(text(), 'From/To')]])[__indexPlusOne__]/following::input[@type='text'])[1]"
                    ],
                    "method": "setValue"
                  }
                ]
              }
            ],
            [
              "endDateMonth_comma_YYYY",
              {
                "actions": [
                  {
                    "path": [
                      "((//p[span[contains(text(), 'From/To')]])[__indexPlusOne__]/following::input[@type='text'])[2]"
                    ],
                    "method": "setValue",
                    "fallbackValue": "N/A"
                  }
                ]
              }
            ]
          ]
        }
      ],
      [
        "over18",
        {
          "actions": [
            {
              "path": [
                "//fieldset[.//legend[contains(text(), 'over 18 years')]]"
              ],
              "method": "clickOption",
              "values": {
                "true": [
                  "Yes"
                ],
                "false": [
                  "No"
                ]
              }
            }
          ]
        }
      ],
      [
        "workAuth",
        {
          "actions": [
            {
              "path": [
                "//fieldset[.//legend[contains(text(), 'able to work in the United States')]]"
              ],
              "method": "clickOption",
              "values": {
                "true": [
                  "Yes"
                ],
                "false": [
                  "No"
                ]
              }
            }
          ]
        }
      ],
      [
        "sponsorship",
        {
          "actions": [
            {
              "path": [
                "//div[./fieldset/legend[contains(text(), 'Please select your answer.')]][preceding::p/span[contains(text(), 'require sponsorship')]]"
              ],
              "method": "clickOption",
              "values": {
                "true": [
                  "Yes"
                ],
                "false": [
                  "No"
                ]
              }
            }
          ]
        }
      ],
      [
        "lift50PoundsWeightAbility",
        {}
      ],
      [
        "resume",
        [
          {
            "actions": [
              {
                "path": [
                  ".//div[@id='attachResume' and not(descendant::div[@class='jv-file'])]//ancestor::body//input[@type='file']"
                ]
              }
            ]
          },
          {
            "actions": [
              {
                "path": [
                  ".//button[@attachment-label='Resume']"
                ],
                "method": "click"
              },
              {
                "path": [
                  ".//div[@class = 'jv-add-attachment-item']//input[@type='file']"
                ],
                "method": "uploadResume"
              }
            ]
          }
        ]
      ],
      [
        "agreement",
        [
          {
            "actions": [
              {
                "path": [
                  ".//label[CONTAINS_TEXT('agree', true) or CONTAINS_TEXT('i certify', true) or CONTAINS_TEXT('i understand', true) or CONTAINS_TEXT('consent', true) or CONTAINS_TEXT('signature', true) or CONTAINS_TEXT('i authorize', true) or CONTAINS_TEXT('i understand', true)]//input[@type='checkbox']"
                ],
                "method": "clickMultiple"
              }
            ]
          },
          {
            "actions": [
              {
                "path": [
                  "//select[@id = //label[CONTAINS_TEXT('prohibited') and CONTAINS_TEXT('person')]/@for and not(self::input[@type='text'])]"
                ],
                "method": "clickOption",
                "values": {
                  "true": [
                    "Yes"
                  ]
                }
              }
            ]
          }
        ]
      ],
      [
        "hispanicLatino",
        {}
      ],
      [
        "gender",
        {
          "actions": [
            {
              "path": [
                "//fieldset[.//legend[contains(text(), 'Gender')]]"
              ],
              "method": "clickOption",
              "values": {
                "Male": [
                  "Male",
                  "Man"
                ],
                "Female": [
                  "Female",
                  "Woman"
                ],
                "Other": [
                  "Other"
                ],
                "Decline to identify": [
                  "Decline to identify",
                  "Decline",
                  "I don't wish",
                  "Prefer not",
                  "Opt Out"
                ]
              }
            }
          ]
        }
      ],
      [
        "genderPronouns",
        {}
      ],
      [
        "transgender",
        {}
      ],
      [
        "race",
        {
          "actions": [
            {
              "path": [
                "//select[contains(@id, 'race') and contains(@name, 'race')]"
              ],
              "method": "clickOption",
              "values": {
                "Black or African American": [
                  "Black",
                  "African"
                ],
                "East Asian": [
                  "East Asian",
                  "Asian"
                ],
                "Hispanic or Latino": "Hispanic",
                "Southeast Asian": [
                  "Southeast Asian",
                  "Asian"
                ],
                "South Asian": [
                  "South Asian",
                  "Asian"
                ],
                "Native Hawaiian or Other Pacific Islander": [
                  "Native Hawaiian",
                  "Pacific Islander"
                ],
                "American Indian or Alaska Native": [
                  "American Indian",
                  "Alaskan Native"
                ],
                "White": "White",
                "Two or More Races": "Two or More",
                "Some Other Race": [
                  "Other",
                  "Decline"
                ],
                "Decline to Answer": [
                  "Decline",
                  "Prefer not"
                ],
                "": [
                  "Decline"
                ]
              }
            }
          ]
        }
      ],
      [
        "veteran",
        {
          "actions": [
            {
              "path": [
                "//select[contains(@id, 'veteranStatus') and contains(@name, 'veteranStatus')]"
              ],
              "method": "clickOption",
              "values": {
                "true": [
                  "Veteran",
                  "I am a ",
                  "I identify ",
                  "Yes"
                ],
                "false": [
                  "Not a ",
                  "I am not a ",
                  "I don't ",
                  "No",
                  "Prefer not"
                ],
                "": [
                  "Decline",
                  "I am not a ",
                  "I don't ",
                  "No",
                  "Prefer not"
                ]
              }
            }
          ]
        }
      ],
      [
        "disability",
        {}
      ],
      [
        "sexualOrientation",
        {}
      ],
      [
        "linkedin",
        []
      ],
      [
        "github",
        []
      ],
      [
        "twitter",
        []
      ],
      [
        "behance",
        []
      ],
      [
        "answerSource",
        [
          {
            "actions": [
              {
                "path": [
                  ".//label[contains(normalize-space(.),'hear about')]/ancestor::div[1]//select"
                ],
                "method": "click",
                "options": {
                  "unmarkFilledStatusIfSomeFails": true
                }
              },
              {
                "path": [
                  ".//label[contains(normalize-space(.),'hear about')]/ancestor::div[1]//select"
                ],
                "method": "clickOptionWithMultiAnswers",
                "values": {
                  "source": [
                    "Google",
                    "Other"
                  ]
                },
                "options": {
                  "lowPriority": [
                    "Indeed",
                    "ZipRecruiter",
                    "LinkedIn",
                    "Glassdoor",
                    "Simplyhired",
                    "Dice",
                    "CareerBuilder",
                    "Monster"
                  ],
                  "prohibited": [
                    "referral",
                    "referred",
                    "connection",
                    "at the company",
                    "for the organization",
                    "employee",
                    "select",
                    "current worker"
                  ],
                  "ignoreFirst": true,
                  "selectFirstExcludingProhibited": true
                }
              }
            ]
          }
        ],
        {
          "keywords": [
            "hear about"
          ]
        }
      ],
      [
        "countryName",
        []
      ],
      [
        "phoneFormatted",
        {
          "actions": [
            {
              "path": [
                "//input[@type='tel' and @id = //label[CONTAINS_TEXT('xxx-xxx-xxxx')]/@for]"
              ],
              "method": "setValueMultiple"
            }
          ]
        }
      ],
      [
        "phoneStripped",
        {
          "actions": [
            {
              "path": [
                ".//input[@autocomplete='tel']"
              ],
              "method": "setValueMultiple"
            }
          ]
        }
      ],
      [
        "phoneCode",
        []
      ],
      [
        "phoneAreaCode",
        [
          "(//input[contains(@id, 'jv-field-phone') and @type='text'])[count(//input[contains(@id, 'jv-field-phone') and @type='text']) = 3][1]"
        ]
      ],
      [
        "phonePrefix",
        [
          "(//input[contains(@id, 'jv-field-phone') and @type='text'])[count(//input[contains(@id, 'jv-field-phone') and @type='text']) = 3][2]"
        ]
      ],
      [
        "phoneLineNumber",
        [
          "(//input[contains(@id, 'jv-field-phone') and @type='text'])[count(//input[contains(@id, 'jv-field-phone') and @type='text']) = 3][3]"
        ]
      ],
      [
        "deviceType",
        {}
      ],
      [
        "certification",
        {
          "addButtonPath": [
            ""
          ],
          "confirmAddedPath": [
            ""
          ],
          "containerPath": [
            "//div[@class='jv-form jv-apply-form' and .//label[contains(text(), 'Credential')]]"
          ],
          "entities": [
            [
              "name",
              {
                "actions": [
                  {
                    "path": [
                      "(.//label[contains(normalize-space(), 'Credential Other')]/following-sibling::div//input)[__indexPlusOne__]"
                    ],
                    "method": "setValue"
                  }
                ]
              }
            ],
            [
              "issueDate",
              {
                "actions": [
                  {
                    "path": [
                      "(.//label[contains(normalize-space(), 'Credential Date')]/following-sibling::div//input)[__indexPlusOne__]"
                    ],
                    "method": "setDateInput",
                    "format": "MM/yyyy",
                    "fullDate": {
                      "path": [
                        "(.//label[contains(normalize-space(), 'Credential Date')]/following-sibling::div//input)[__indexPlusOne__]"
                      ],
                      "format": "yyyy-MM-dd"
                    }
                  }
                ]
              }
            ]
          ]
        }
      ],
      [
        "skill",
        {}
      ],
      [
        "lgbt",
        {}
      ],
      [
        "armedForces",
        {}
      ],
      [
        "currentDate.dateString",
        [
          {
            "actions": [
              {
                "method": "setDateInput",
                "format": "MM/dd/yyyy",
                "multiple": true,
                "fullDate": {
                  "path": [
                    "//input[@id = //label[CONTAINS_TEXT('agreement') and CONTAINS_TEXT('date')]/@for]",
                    "//input[@id = //label[normalize-space(translate(., '*', '')) = 'Date']/@for]"
                  ],
                  "format": "yyyy-MM-dd"
                }
              }
            ]
          }
        ]
      ],
      [
        "currentDateDashes",
        {
          "actions": [
            {
              "path": [
                "//input[contains(@name, 'input-date') and @type='date' and @id = //label[starts-with(normalize-space(text()), 'Today') or starts-with(normalize-space(text()), 'Date')]/@for]",
                "//input[@id = //label[CONTAINS_TEXT('signature') and CONTAINS_TEXT('date') and @for]/@for]"
              ],
              "method": "setValueMultiple",
              "options": {
                "isRepeatedAcrossSteps": true
              }
            }
          ]
        }
      ],
      [
        "highestEducation.name",
        [
          {
            "actions": [
              {
                "path": [
                  "//select[@id = //label[(CONTAINS_TEXT('university') or CONTAINS_TEXT('college') or CONTAINS_TEXT('school') or CONTAINS_TEXT('institution'))]/@for and not(self::input[@type='text'])]"
                ],
                "method": "clickOption",
                "options": {
                  "fallbackToOptionIndex": 2
                }
              }
            ]
          }
        ]
      ],
      [
        "highestEducation.degreeDisplay",
        [
          {
            "actions": [
              {
                "path": [
                  "//input[@type='text' and @id = //label[CONTAINS_TEXT('degree')]/@for]"
                ],
                "method": "setValue"
              }
            ]
          }
        ]
      ],
      [
        "workStartDateAvailabilityString",
        [
          {
            "actions": [
              {
                "method": "setDateInput",
                "format": "MM/dd/yyyy",
                "fullDate": {
                  "path": [
                    "//input[@id = //label[(CONTAINS_TEXT('date') and CONTAINS_TEXT('start') and not(CONTAINS_TEXT('employment'))) or (CONTAINS_TEXT('available') and CONTAINS_TEXT('begin') and not(CONTAINS_TEXT('employment')))]/@for]"
                  ],
                  "format": "yyyy-MM-dd"
                }
              }
            ]
          }
        ]
      ],
      [
        "minYearlySalaryDesired",
        [
          {
            "actions": [
              {
                "path": [
                  "//input[@id = //label[CONTAINS_TEXT('desired') and CONTAINS_TEXT('salary')]/@for]",
                  "//div[@id = //label[CONTAINS_TEXT('expected') and CONTAINS_TEXT('salary')]/@for]//input",
                  "//input[@id=//label[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'salary')]/@for]"
                ],
                "method": "setValue"
              }
            ]
          }
        ]
      ],
      [
        "workStartDateFormatted.startDateDashes_YYYYMMDD",
        [
          {
            "actions": [
              {
                "path": [
                  "//input[@type='date' and @id = //label[CONTAINS_TEXT('availab') and CONTAINS_TEXT('start')]/@for]"
                ],
                "method": "setValue"
              }
            ]
          }
        ]
      ],
      [
        "privacyAgreement",
        {}
      ],
      [
        "cityLocated",
        []
      ],
      [
        "phoneType",
        {}
      ],
      [
        "addressType",
        {}
      ],
      [
        "county",
        {}
      ],
      [
        "language",
        {
          "actions": [
            {
              "path": [
                "//select[@id='jv-country-select' and @ng-required='true']"
              ],
              "method": "click"
            },
            {
              "path": [
                "//select[@id='jv-country-select']"
              ],
              "method": "clickOption",
              "values": {
                "English": [
                  "English"
                ]
              },
              "options": {
                "fallbackOption": "Other"
              }
            }
          ]
        }
      ]
    ],
    "confirmSubmittedForm": {
      "confirmMessageXPath": [
        ".//body[contains(@class, 'jv-page-applyconfirm')]//h2[contains(@class, 'jv-page-message-header')]",
        ".//body[contains(@class, 'jv-page-applyduplicate')]//p[contains(@class, 'jv-page-error-header')]"
      ]
    },
    "signIn": {
      "urls": [],
      "submitButton": [],
      "createAccount": [],
      "forgotPassword": [],
      "email": [],
      "password": [],
      "errorMessage": [],
      "endpoint": "",
      "verifyPassword": []
    },
    "signUp": {
      "errorMessage": [],
      "submitButton": [],
      "email": [],
      "password": [],
      "verifyPassword": [],
      "endpoint": "",
      "saveStrategy": "",
      "urls": [],
      "userName": []
    }
  },
  "lever": {
    "atsName": "lever",
    "urls": [
      "*://jobs.lever.co/*/*/apply"
    ],
    "urlsExclude": [],
    "submitButtonPaths": [
      ".//button[@id='btn-submit' or @data-qa='btn-submit']"
    ],
    "nextStepButtonPaths": [],
    "nextStepDynamicLoad": false,
    "validationErrorXPaths": [
      "//p[@class='error-message']"
    ],
    "validationCheckFormValidity": true,
    "errorBannerXPaths": [],
    "questionValidationErrorSelectors": [
      "p.error-message"
    ],
    "targetNodeXPath": [
      ".//form[@id='application-form']",
      ".//div[contains(@class, 'content-wrapper')]"
    ],
    "targetFrameNodeXPath": [],
    "confirmSubmittedForm": {
      "confirmMessageXPath": [
        ".//div[contains(@class, 'confirmation') and contains(@class, 'message')]//h3[contains(@data-qa, 'msg-submit-success')]"
      ],
      "urls": [
        "*://jobs.lever.co/*/*/thanks"
      ]
    },
    "networkOptions": {
      "blacklistedUrlParts": [
        "linkedin",
        "analytics",
        "insights",
        "track",
        "blob",
        "parseResume",
        "hcaptcha.com",
        "lever.co/js"
      ]
    },
    "customQuestions": {
      "patterns": {
        "questionId": "",
        "innerSelectors": [
          ".//li[contains(@class, 'application-question custom-question')]",
          ".//select[@data-qa='opportunity-location-select' or @data-qa='candidate-location-select']"
        ],
        "selectInputTagName": "select",
        "selectInputAttrName": "",
        "selectInputAttrValue": "",
        "maxLabelLevel": "",
        "radioGroupAttrName": "data-qa",
        "radioGroupAttrValue": "multiple-choice",
        "listboxTagName": "",
        "questionParent": "[class*='application-question']",
        "fieldsetMatchQuerySelector": "[class*='application-field']:has(li)"
      },
      "selectors": {
        "title": "h2",
        "label": "div.application-label",
        "legend": "legend",
        "ariaLabelledBy": "label",
        "listOption": "li:not([class*='application'])",
        "roleOption": "[role='option']",
        "radioInput": "input[type='radio']",
        "monthInput": "input[aria-valuetext='MM']",
        "dateInput": "input[aria-valuetext='DD']",
        "yearInput": "input[aria-valuetext='YYYY']",
        "checkbox": "input[type='checkbox']",
        "question": "[class*='application-field'], textarea:not([aria-hidden])",
        "subTitle": "h4",
        "mapOption": "div[class*='dropdown'], select > option"
      },
      "xpaths": {
        "currentListItem": [],
        "listInputBackBtnText": [],
        "selectPopupXPath": [],
        "listBoxPopupXPath": [],
        "selectedItemListXPath": [],
        "targetNodeXPath": [],
        "requiredFieldXPath": [
          ".//span[@class='required' and contains(text(), *)]"
        ]
      },
      "ignoreQuestions": [],
      "maxSelectOptionsCount": 3000
    },
    "jobXPaths": {
      "entities": []
    },
    "canJobBeAppliedXPaths": {
      "applyButton": [
        ".//a[contains(@class,'template-btn-submit') and not(ancestor::div[contains(@class,'confirmation') and contains(@class,'message')])]",
        ".//a[@data-qa='show-page-apply']"
      ]
    },
    "contextData": {
      "classifier": {
        "applyBtnPath": [
          "//a[contains(@href, 'jobs.lever.co') and CONTAINS_TEXT('apply', true)]"
        ]
      },
      "options": {}
    },
    "preApply": {
      "urls": [
        "*://jobs.lever.co/*/*"
      ],
      "urlsExclude": [],
      "entities": [
        [
          "applyBtn",
          {
            "actions": [
              {
                "key": "canJobBeAppliedXPaths.applyButton",
                "method": "click"
              }
            ]
          }
        ]
      ]
    },
    "entities": [
      [
        "applyBtn",
        {
          "actions": [
            {
              "path": [
                ".//a[contains(@class, 'template-btn-submit') and not(ancestor::div[contains(@class,'confirmation') and contains(@class,'message')])]",
                ".//a[@data-qa='show-page-apply']"
              ],
              "method": "click"
            }
          ]
        }
      ],
      [
        "firstName",
        []
      ],
      [
        "lastName",
        []
      ],
      [
        "preferredFirstName",
        []
      ],
      [
        "legalFirstName",
        []
      ],
      [
        "legalLastName",
        []
      ],
      [
        "fullName",
        [
          ".//input[@data-qa='name-input']"
        ]
      ],
      [
        "email",
        [
          ".//input[@data-qa='email-input' or @name='email']"
        ]
      ],
      [
        "phone",
        [
          ".//input[@data-qa='phone-input' or @name='phone']"
        ]
      ],
      [
        "addressLine1",
        []
      ],
      [
        "recentExperience.companyName",
        {
          "actions": [
            {
              "path": [
                ".//input[@data-qa='org-input' or @name='org']"
              ],
              "method": "setValue"
            }
          ]
        }
      ],
      [
        "recentExperience.title",
        []
      ],
      [
        "answerSource",
        [
          {
            "actions": [
              {
                "path": [
                  ".//input[contains(@name, 'did you find out about') and not(contains(@name, 'urls'))]"
                ],
                "method": "setValue",
                "defaultValue": "Job Board"
              }
            ]
          },
          {
            "actions": [
              {
                "path": [
                  ".//input[contains(@name, 'did you find out about') and contains(@name, 'urls')]"
                ],
                "method": "setValue",
                "defaultValue": "https://www.linkedin.com/"
              }
            ]
          }
        ]
      ],
      [
        "state",
        []
      ],
      [
        "stateName",
        []
      ],
      [
        "postalCode",
        []
      ],
      [
        "city",
        {}
      ],
      [
        "cityState",
        [
          {
            "actions": [
              {
                "path": [
                  ".//input[@data-qa='location-input' or @id='location-input']"
                ],
                "method": "setValue",
                "options": {
                  "triggerKeyDownEvent": true,
                  "triggerBlurEvent": false,
                  "waitForNetworkAfterInteraction": true,
                  "shouldWaitForFirstRequest": true,
                  "trackQuestion": true
                }
              },
              {
                "path": [
                  ".//div[contains(@class, 'dropdown-results')]"
                ],
                "method": "clickOption",
                "options": {
                  "waitForNetworkBeforeInteraction": true,
                  "optionMapper": true,
                  "disableNestedMatchCheck": true
                }
              }
            ]
          }
        ]
      ],
      [
        "cityStateName",
        []
      ],
      [
        "resume",
        {
          "actions": [
            {
              "path": [
                ".//input[@data-qa='input-resume' or contains(@class, 'invisible-resume-upload')]",
                "//li[contains(@class,'application-question')][.//div[contains(@class,'text') and contains(normalize-space(.),'Resume Upload')]]//input[@data-qa='application-file-upload' or contains(@class,'invisible-resume-upload')]"
              ],
              "method": "uploadMultipleResumes"
            }
          ]
        }
      ],
      [
        "country",
        [
          {
            "actions": [
              {
                "path": [
                  ".//select[@data-qa='candidate-location-select']"
                ],
                "method": "clickOption"
              }
            ]
          }
        ]
      ],
      [
        "education",
        {
          "addButtonPath": [],
          "confirmAddedPath": [],
          "containerPath": [],
          "entities": [
            [
              "name",
              []
            ],
            [
              "degree",
              []
            ],
            [
              "major",
              []
            ],
            [
              "startDateMonth_MM",
              []
            ],
            [
              "endDateMonth_MM",
              []
            ],
            [
              "startDateMonthText",
              []
            ],
            [
              "endDateMonthText",
              []
            ],
            [
              "startDateYear",
              []
            ],
            [
              "endDateYear",
              []
            ]
          ]
        }
      ],
      [
        "experience",
        {
          "addButtonPath": [],
          "confirmAddedPath": [],
          "containerPath": [],
          "entities": [
            [
              "title",
              []
            ],
            [
              "companyName",
              []
            ],
            [
              "cityState",
              []
            ],
            [
              "isCurrent",
              []
            ],
            [
              "startDate",
              []
            ],
            [
              "endDate",
              []
            ],
            [
              "description",
              []
            ]
          ]
        }
      ],
      [
        "over18",
        {
          "actions": [
            {
              "path": [
                ".//div[(CONTAINS_TEXT('over') and CONTAINS_TEXT('18')) or CONTAINS_TEXT('18 years')]/parent::*//div[@class='application-label']"
              ],
              "method": "clickOption",
              "values": {
                "true": [
                  "Yes"
                ],
                "false": [
                  "No"
                ]
              }
            }
          ]
        }
      ],
      [
        "weekdaysAvailability",
        {}
      ],
      [
        "weekendsAvailability",
        {}
      ],
      [
        "openSchedule",
        {}
      ],
      [
        "flexibleSchedule",
        {}
      ],
      [
        "dayShift",
        {}
      ],
      [
        "nightShift",
        {}
      ],
      [
        "swingShift",
        {}
      ],
      [
        "overnightShift",
        {}
      ],
      [
        "anyShift",
        {}
      ],
      [
        "workAuth",
        {}
      ],
      [
        "sponsorship",
        {}
      ],
      [
        "lift50PoundsWeightAbility",
        {}
      ],
      [
        "agreement",
        []
      ],
      [
        "hispanicLatino",
        {}
      ],
      [
        "gender",
        {
          "actions": [
            {
              "path": [
                ".//select[@name='eeo[gender]']",
                ".//li[contains(@class, 'application-question')]//div[contains(@class, 'application-label') and .//div[contains(@class, 'text') and contains(text(), 'gender')]]/following-sibling::div[contains(@class, 'application-field')]//ul[@data-qa='multiple-choice']"
              ],
              "method": "clickOption",
              "values": {
                "Male": [
                  "Male",
                  "Man"
                ],
                "Female": [
                  "Female",
                  "Woman"
                ],
                "I do not want to answer": [
                  "Decline",
                  "I don't wish",
                  "Prefer not"
                ],
                "": [
                  "Decline",
                  "I don't wish",
                  "Prefer not"
                ]
              }
            }
          ]
        }
      ],
      [
        "genderPronouns",
        {
          "actions": [
            {
              "path": [
                ".//ul[@data-qa='candidatePronounsCheckboxes' or @id='candidatePronounsCheckboxes']//div[@class='column-wrapper']"
              ],
              "method": "clickOptionWithMultiAnswers",
              "values": {
                "He/him/his": [
                  "he"
                ],
                "She/her/hers": [
                  "she"
                ],
                "They/them/theirs": [
                  "they"
                ],
                "Ze/hir/hirs": [
                  "ze"
                ],
                "Xe/xem/xyrs": [
                  "xe"
                ],
                "Ey/em/eirs": [
                  "ey"
                ],
                "Ve/ver/vis": [
                  "ve"
                ],
                "Per/per/pers": [
                  "per"
                ],
                "Ne/nem/nirs": [
                  "ne"
                ],
                "Other": [
                  "other"
                ],
                "I do not want to answer": [
                  "Decline",
                  "I don't wish",
                  "Prefer not"
                ],
                "": [
                  "Decline",
                  "I don't wish",
                  "Prefer not"
                ]
              }
            }
          ]
        }
      ],
      [
        "veteran",
        {
          "actions": [
            {
              "path": [
                ".//select[@name='eeo[veteran]']",
                ".//li[contains(@class, 'application-question')]//div[contains(@class, 'application-label') and .//div[contains(@class, 'text') and contains(text(), 'Veteran Status')]]/following-sibling::div[contains(@class, 'application-field')]//ul[@data-qa='multiple-choice']"
              ],
              "method": "clickOption",
              "values": {
                "true": [
                  "I am a ",
                  "I identify ",
                  "Yes"
                ],
                "false": [
                  "I am not a ",
                  "I don't ",
                  "No",
                  "Prefer not"
                ],
                "": [
                  "Decline",
                  "I am not a ",
                  "I don't ",
                  "No",
                  "Prefer not"
                ]
              }
            }
          ]
        }
      ],
      [
        "disability",
        {
          "actions": [
            {
              "path": [
                "//select[@id='disabilitySelectElement' or @name='eeo[disability]']",
                ".//li[contains(@class, 'application-question')]//div[contains(@class, 'application-label') and .//div[contains(@class, 'text') and contains(text(), 'Disability')]]/following-sibling::div[contains(@class, 'application-field')]//ul[@data-qa='multiple-choice']"
              ],
              "method": "clickOption",
              "values": {
                "true": [
                  "Yes ",
                  "Yes,",
                  "Yes",
                  "I have"
                ],
                "false": [
                  "No ",
                  "No,",
                  "No",
                  "I do not have",
                  "Prefer not"
                ],
                "": [
                  "Decline",
                  "No ",
                  "No",
                  "I don't wish",
                  "Prefer not"
                ]
              }
            }
          ]
        }
      ],
      [
        "disabilitySignature",
        {
          "actions": [
            {
              "path": [
                ".//input[@name='eeo[disabilitySignature]']"
              ],
              "method": "setValue",
              "userDataParam": "__fullName__"
            }
          ]
        }
      ],
      [
        "sexualOrientation",
        {}
      ],
      [
        "countryName",
        []
      ],
      [
        "phoneStripped",
        []
      ],
      [
        "phoneCode",
        []
      ],
      [
        "deviceType",
        {}
      ],
      [
        "certification",
        {
          "addButtonPath": [],
          "confirmAddedPath": [],
          "containerPath": [],
          "entities": [
            [
              "name",
              []
            ],
            [
              "issueDateSlashes_MMDDYYYY",
              []
            ]
          ]
        }
      ],
      [
        "skill",
        {
          "containerPath": [],
          "entities": [
            [
              "name",
              []
            ]
          ],
          "options": {
            "clickOutsideAtEnd": false
          }
        }
      ],
      [
        "lgbt",
        {}
      ],
      [
        "armedForces",
        {}
      ],
      [
        "currentDate",
        [
          ".//input[@name='eeo[disabilitySignatureDate]']"
        ]
      ],
      [
        "currentDateDashes",
        {}
      ],
      [
        "language",
        {}
      ],
      [
        "workStartDateAvailabilityString",
        {}
      ],
      [
        "privacyAgreement",
        {
          "actions": [
            {
              "path": [
                "//input[@name='consent[store]' and @type='checkbox']"
              ],
              "method": "click"
            }
          ]
        },
        {
          "keywords": [
            "privacy agreement",
            "consent to"
          ]
        }
      ],
      [
        "middleName",
        {}
      ],
      [
        "street",
        []
      ],
      [
        "cityLocated",
        []
      ],
      [
        "phoneType",
        {}
      ],
      [
        "phoneFormatted",
        []
      ],
      [
        "homePhoneFormatted",
        []
      ],
      [
        "referral",
        {}
      ],
      [
        "applyDate",
        {}
      ],
      [
        "minYearlySalaryDesired",
        []
      ],
      [
        "addressType",
        {}
      ],
      [
        "birthDay",
        {}
      ],
      [
        "birthMonth",
        {}
      ],
      [
        "county",
        {}
      ],
      [
        "addressLine2",
        []
      ],
      [
        "highestEducation.name",
        {
          "actions": [
            {
              "path": [
                ".//select[contains(@id, 'university-picker')]",
                "//li[contains(@class,'application-question') and contains(translate(.//div[@class='text'],'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'university') and contains(translate(.//div[@class='text'],'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'currently')]//select"
              ],
              "method": "clickOption",
              "options": {
                "optionMapper": true
              }
            }
          ]
        },
        {
          "keywords": [
            "university"
          ]
        }
      ],
      [
        "highestEducation.degreeDisplay",
        []
      ],
      [
        "workStartDateAvailability",
        []
      ]
    ],
    "validationErrorPersistent": true,
    "attachedContainer": [],
    "screenshot": {
      "hide": [
        "div[aria-label='cookieconsent']",
        "div[class*='main-header']"
      ]
    }
  },
  "meta": {
    "atsName": "meta",
    "urls": [
      "*://*.metacareers.com/resume/*"
    ],
    "detectPageQuestions": true,
    "submitButtonPaths": [
      "//button[@id='appSubmitButton']"
    ],
    "nextStepButtonPaths": [
      "//a[div[normalize-space(text())='Next']]"
    ],
    "backStepButtonPaths": [
      "//a[div[normalize-space(text())='Back']]"
    ],
    "backStepDiscardButtonPaths": [],
    "checkForErrorsBeforeNext": true,
    "validateUsingQuestionErrorSelectors": true,
    "validationErrorXPaths": [],
    "pageFailureKeywords": [],
    "errorBannerXPaths": [],
    "globalOptions": {
      "waitForAllRequestsBeforeFillingStep": true
    },
    "networkOptions": {
      "blacklistedUrlParts": [
        "linkedin",
        "analytics",
        "insights",
        "collect"
      ]
    },
    "confirmSubmittedForm": {
      "confirmMessageXPath": [],
      "urls": [],
      "confirmMessageSelector": ""
    },
    "questionValidationErrorSelectors": [
      "span[class*='x2h8tww']"
    ],
    "targetNodeXPath": [
      ".//main[@id='main']",
      "(.//div[@id='careersContentContainer']//div[.//ul and .//div]/div)[last()]"
    ],
    "expiredJob": [
      {
        "container": [
          ".//p"
        ],
        "keywords": [
          "no longer available",
          "has been removed"
        ],
        "urls": [
          "*://metacareers.dejobs.org/jobs/*"
        ]
      }
    ],
    "forceNewJobSearch": true,
    "canJobBeAppliedXPaths": {
      "applyButton": []
    },
    "formatElements": "",
    "customQuestions": {
      "patterns": {
        "questionId": "",
        "questionParent": ""
      },
      "selectors": {
        "question": "input[type='text']:not([aria-hidden='true'])",
        "questionParent": "div[class*='jobLocations']",
        "subTitle": "h2",
        "label": "label",
        "legend": "",
        "ariaLabelledBy": "",
        "roleOption": "li[role='option']",
        "radioInput": "input[type='radio']",
        "checkbox": "input[type='checkbox']",
        "mapOption": "li[role='option']",
        "selectPopup": ""
      },
      "xpaths": {
        "currentListItem": [],
        "listInputBackBtnText": [],
        "selectPopupXPath": [],
        "listBoxPopupXPath": [],
        "selectedItemListXPath": [],
        "requiredFieldXPath": []
      },
      "ignoreQuestions": [
        "//input[@placeholder='Concentration']"
      ]
    },
    "jobXPaths": {
      "entities": [
        [
          "titleDisplay",
          [
            "(//h2[//span]//span)[1]",
            "//meta[@property='og:title']/@content"
          ]
        ],
        [
          "originalCompanyName",
          [
            "//h1[contains(@class, 'sr-only')]",
            "//meta[@property='og:site_name']/@content"
          ]
        ],
        [
          "jobTypes",
          [
            ".//span[@data-ui='job-type']"
          ]
        ],
        [
          "url",
          [
            "//meta[@property='og:url']/@content"
          ]
        ],
        [
          "desc",
          [
            "//div[contains(@class, 'prose') and @tabindex='0']",
            "//div[contains(@id, 'careersContentContainer')]/div/div[2]"
          ]
        ],
        [
          "locationDisplay",
          [
            "(//h2[//span]//span)[2]"
          ]
        ]
      ]
    },
    "preApply": {
      "urls": [
        "*://metacareers.dejobs.org/*/job/*",
        "*://*.metacareers.com/jobs/*"
      ],
      "entities": [
        [
          "applyButton",
          {
            "actions": [
              {
                "path": [
                  ".//a[CONTAINS_TEXT('apply now', true)]",
                  ".//a[@role='button' and CONTAINS_TEXT('apply to', true)]"
                ],
                "method": "openLinkInSameTab"
              }
            ]
          },
          {
            "keywords": [
              "apply"
            ]
          }
        ]
      ]
    },
    "entities": [
      [
        "fullName",
        {
          "actions": [
            {
              "path": [
                ".//input[@name='candidateName']"
              ],
              "method": "setValue",
              "options": {
                "wait": 0
              }
            }
          ]
        },
        {
          "keywords": [
            "full name"
          ]
        }
      ],
      [
        "cityStateName",
        {
          "actions": [
            {
              "path": [
                ".//div[@id='candidateLocationFBID']//input[@role='combobox']"
              ],
              "method": "setValue",
              "options": {
                "waitForNetworkAfterInteraction": true,
                "triggerBlurEvent": false,
                "triggerKeyDownEvent": true,
                "triggerFocusEvent": true,
                "triggerFocusInEvent": true,
                "wait": 300
              }
            },
            {
              "path": [
                "//div[@data-ownerid=//div[@id='candidateLocationFBID']//label[input[@role='combobox']]/@id]//ul"
              ],
              "method": "clickOption",
              "options": {
                "optionMapper": true,
                "waitForNetworkBeforeInteraction": true
              }
            }
          ]
        },
        {
          "keywords": [
            "location"
          ]
        }
      ],
      [
        "email",
        {
          "actions": [
            {
              "path": [
                ".//input[@name='candidateEmail']"
              ],
              "method": "setValue",
              "options": {
                "wait": 0
              }
            }
          ]
        },
        {
          "keywords": [
            "email"
          ]
        }
      ],
      [
        "phone",
        {
          "actions": [
            {
              "path": [
                ".//input[@name='candidatePhone']"
              ],
              "method": "setValue",
              "options": {
                "wait": 0
              }
            }
          ]
        },
        {
          "keywords": [
            "phone"
          ]
        }
      ],
      [
        "resume",
        {
          "actions": [
            {
              "path": [
                ".//div[h2[CONTAINS_TEXT('resume', true)]]//input[@name='file']"
              ],
              "method": "uploadResume"
            }
          ]
        },
        {
          "keywords": [
            "resume"
          ]
        }
      ],
      [
        "useParser",
        {
          "actions": [
            {
              "path": [
                "(.//div[contains(@class, 'candidateResumeFile')]//input[@type='radio'])[2]"
              ],
              "method": "click"
            }
          ]
        },
        {
          "keywords": [
            "add the information myself",
            "resume"
          ]
        }
      ],
      [
        "education",
        {
          "addButtonPath": [
            "//button[contains(., 'Add Another Degree')]"
          ],
          "containerPath": [
            "(.//div[div[contains(@id, 'college')]])[__indexPlusOne__]"
          ],
          "confirmAddedPath": [
            "(.//div[div[contains(@id, 'college')]])[__indexPlusOne__]"
          ],
          "entities": [
            [
              "name",
              [
                ".//div[contains(@id, 'college')]//input"
              ],
              {
                "keywords": [
                  "school"
                ]
              }
            ],
            [
              "degree",
              {
                "actions": [
                  {
                    "path": [
                      ".//select"
                    ],
                    "method": "clickOption",
                    "values": {
                      "bachelor's": [
                        "Bachelors"
                      ],
                      "master's": [
                        "Masters"
                      ],
                      "doctorate": [
                        "PHD"
                      ]
                    },
                    "options": {
                      "usePrototypeValueSetter": true,
                      "optionMapper": false
                    }
                  }
                ]
              },
              {
                "keywords": [
                  "degree"
                ]
              }
            ],
            [
              "major",
              {
                "actions": [
                  {
                    "path": [
                      "(.//div[contains(@id, 'concentration')]//input)[1]"
                    ],
                    "method": "setValue",
                    "options": {
                      "wait": 0
                    }
                  }
                ]
              },
              {
                "keywords": [
                  "concentration"
                ]
              }
            ]
          ],
          "options": {
            "disabledAddButtonCaching": true,
            "skipDegree": "highschool"
          }
        },
        {
          "keywords": [
            "education"
          ]
        }
      ],
      [
        "highschool",
        {
          "actions": [
            {
              "path": [
                ".//input[@name='highSchoolName']"
              ],
              "method": "setValue",
              "options": {
                "wait": 0
              }
            }
          ]
        },
        {
          "keywords": [
            "highschool"
          ]
        }
      ],
      [
        "isFirstJob",
        {
          "actions": [
            {
              "path": [
                "(.//div[contains(@class, 'noWorkExperience')]//input[@type='radio'])[2]"
              ],
              "method": "click"
            }
          ]
        },
        {
          "keywords": [
            "your first job"
          ]
        }
      ],
      [
        "experience",
        {
          "addButtonPath": [
            "//button[contains(., 'Add Another Job')]"
          ],
          "containerPath": [
            "(.//div[div[contains(@id, 'workEmployerNames')]])[__indexPlusOne__]"
          ],
          "confirmAddedPath": [
            "(.//div[div[contains(@id, 'workEmployerNames')]])[__indexPlusOne__]"
          ],
          "entities": [
            [
              "title",
              [
                ".//div[contains(@id, 'workPositionNames')]//input"
              ],
              {
                "keywords": [
                  "title",
                  "position"
                ]
              }
            ],
            [
              "companyName",
              [
                ".//div[contains(@id, 'workEmployerNames')]//input"
              ],
              {
                "keywords": [
                  "company",
                  "employer"
                ]
              }
            ],
            [
              "cityStateName",
              {
                "actions": [
                  {
                    "path": [
                      ".//div[contains(@id, 'workLocationFBIDs')]//input[@role='combobox']"
                    ],
                    "method": "setValue",
                    "options": {
                      "waitForNetworkAfterInteraction": true,
                      "triggerBlurEvent": false,
                      "triggerKeyDownEvent": true,
                      "triggerFocusEvent": true,
                      "triggerFocusInEvent": true,
                      "wait": 300
                    }
                  },
                  {
                    "path": [
                      "//div[@data-ownerid=//div[contains(@id, 'workLocationFBIDs')][__index__]//label[input[@role='combobox']]/@id]//ul"
                    ],
                    "method": "clickOption",
                    "options": {
                      "optionMapper": true,
                      "waitForNetworkBeforeInteraction": true
                    }
                  }
                ]
              },
              {
                "keywords": [
                  "location"
                ]
              }
            ],
            [
              "description",
              [
                ".//textarea[contains(@name, 'workDescriptions')]"
              ],
              {
                "keywords": [
                  "description",
                  "summary"
                ]
              }
            ],
            [
              "startDate",
              {
                "actions": [
                  {
                    "path": [
                      ".//input[contains(@name,'workStartMonths')]"
                    ],
                    "method": "setValue",
                    "options": {
                      "wait": 0
                    }
                  },
                  {
                    "path": [
                      ".//input[contains(@name,'workStartMonths')]"
                    ],
                    "method": "pressEnterKey"
                  }
                ]
              },
              {
                "keywords": [
                  "start"
                ]
              }
            ],
            [
              "endDate",
              {
                "actions": [
                  {
                    "path": [
                      ".//input[contains(@name,'workEndMonths')]"
                    ],
                    "method": "setValue",
                    "options": {
                      "wait": 0
                    }
                  },
                  {
                    "path": [
                      ".//input[contains(@name,'workEndMonths')]"
                    ],
                    "method": "pressEnterKey"
                  }
                ]
              },
              {
                "keywords": [
                  "end"
                ]
              }
            ],
            [
              "isCurrent",
              [
                ".//input[@type='checkbox' and contains(@id,'workIsCurrent')]"
              ],
              {
                "keywords": [
                  "currently work"
                ]
              }
            ]
          ],
          "options": {
            "disabledAddButtonCaching": true
          }
        },
        {
          "keywords": [
            "experience"
          ]
        }
      ],
      [
        "skill",
        {
          "containerPath": [
            ".//div[contains(@id, 'candidateSkills')]"
          ],
          "entities": [
            [
              "name",
              {
                "actions": [
                  {
                    "path": [
                      ".//input[@role='combobox']"
                    ],
                    "method": "setValue",
                    "options": {
                      "triggerKeyDownEvent": true,
                      "triggerFocusEvent": true,
                      "triggerFocusInEvent": true,
                      "triggerBlurEvent": false,
                      "wait": 0,
                      "waitForNetworkAfterInteraction": true
                    }
                  },
                  {
                    "path": [
                      "//div[@data-ownerid=//div[contains(@id, 'candidateSkills')]//label[input[@role='combobox']]/@id]//ul/li[@role='option']"
                    ],
                    "method": "click",
                    "options": {
                      "waitForNetworkBeforeInteraction": true,
                      "waitForElementTimeout": 5000
                    }
                  }
                ]
              },
              {
                "keywords": [
                  "skills"
                ]
              }
            ]
          ]
        },
        {
          "keywords": [
            "skills"
          ]
        }
      ],
      [
        "sponsorship",
        {
          "actions": [
            {
              "path": [
                "//div[contains(@class, 'requiresSponsorship')]"
              ],
              "method": "clickOption",
              "values": {
                "true": "Yes",
                "false": "No"
              },
              "options": {
                "closestCommon": "div",
                "elementToClick": "input[type='radio']"
              }
            }
          ]
        },
        {
          "keywords": [
            "sponsorship"
          ]
        }
      ],
      [
        "workAuth",
        {
          "actions": [
            {
              "path": [
                "//div[contains(@class, 'workEligibleUS')]"
              ],
              "method": "clickOption",
              "values": {
                "true": "Yes",
                "false": "No"
              },
              "options": {
                "closestCommon": "div",
                "elementToClick": "input[type='radio']"
              }
            }
          ]
        },
        {
          "keywords": [
            "work authorization"
          ]
        }
      ],
      [
        "gender",
        {
          "actions": [
            {
              "path": [
                "//div[contains(@class, 'candidateGender')]"
              ],
              "method": "clickOption",
              "values": {
                "Male": [
                  "Male"
                ],
                "Female": [
                  "Female"
                ],
                "Other": [
                  "I choose not to disclose"
                ],
                "Decline to identify": [
                  "I choose not to disclose"
                ]
              },
              "options": {
                "closestCommon": "div",
                "elementToClick": "input[type='radio']"
              }
            }
          ]
        },
        {
          "keywords": [
            "your gender"
          ]
        }
      ],
      [
        "race",
        {
          "actions": [
            {
              "path": [
                ".//div[contains(@class, 'candidateRaceEthnicities')]"
              ],
              "method": "clickOption",
              "values": {
                "Black or African American": [
                  "Black",
                  "African American"
                ],
                "East Asian": [
                  "Asian"
                ],
                "Hispanic or Latino": [
                  "Hispanic",
                  "Latino"
                ],
                "Southeast Asian": [
                  "Asian"
                ],
                "South Asian": [
                  "Asian"
                ],
                "Native Hawaiian or Other Pacific Islander": [
                  "Native Hawaiian",
                  "Pacific Islander"
                ],
                "American Indian or Alaska Native": [
                  "Native American",
                  "Alaska Native"
                ],
                "White": [
                  "White"
                ],
                "Two or More Races": [
                  "Two or More Races"
                ],
                "Some Other Race": [
                  "I choose not to "
                ],
                "Decline to Answer": [
                  "I choose not to "
                ],
                "": [
                  "I choose not to "
                ]
              },
              "options": {
                "closestCommon": "div",
                "elementToClick": "input[type='radio']",
                "caseSentiveOption": true
              }
            }
          ]
        },
        {
          "keywords": [
            "race and ethnicity"
          ]
        }
      ],
      [
        "veteran",
        [
          {
            "actions": [
              {
                "path": [
                  "//div[contains(@class, 'veteranStatus')]"
                ],
                "method": "clickOption",
                "values": {
                  "true": [
                    "I identify "
                  ],
                  "false": [
                    "I am not a "
                  ],
                  "": [
                    "I choose not "
                  ]
                },
                "options": {
                  "closestCommon": "div",
                  "elementToClick": "input[type='radio']"
                }
              }
            ]
          }
        ],
        {
          "keywords": [
            "veteran"
          ]
        }
      ],
      [
        "disability",
        [
          {
            "actions": [
              {
                "path": [
                  "//div[contains(@class, 'disabilityStatus')]"
                ],
                "method": "clickOption",
                "values": {
                  "true": [
                    "Yes, "
                  ],
                  "false": [
                    "No, "
                  ],
                  "": [
                    "I do not want"
                  ]
                },
                "options": {
                  "closestCommon": "div",
                  "elementToClick": "input[type='radio']"
                }
              }
            ]
          }
        ],
        {
          "keywords": [
            "disability"
          ]
        }
      ]
    ],
    "entitiesAfterLLM": [
      [
        "country",
        {
          "actions": [
            {
              "path": [
                ".//input[@id='remoteGeoCountryPreferences']"
              ],
              "method": "setValue",
              "defaultValue": "United States",
              "options": {
                "triggerKeyDownEvent": true,
                "triggerFocusEvent": true,
                "triggerFocusInEvent": true,
                "triggerBlurEvent": false,
                "wait": 300
              }
            },
            {
              "path": [
                "//div[@data-ownerid=//div[@id='remoteGeoCountryPreferences']//label[input[@role='combobox']]/@id]//ul"
              ],
              "method": "clickOption",
              "values": {
                "United States": [
                  "United States"
                ]
              },
              "options": {
                "waitForNetworkBeforeInteraction": true
              }
            }
          ]
        },
        {
          "keywords": [
            "country"
          ]
        }
      ],
      [
        "userLocationStateNames",
        {
          "containerPath": [
            ".//div[contains(@id, 'remoteGeoStatePreferences')]"
          ],
          "entities": [
            [
              "name",
              {
                "actions": [
                  {
                    "path": [
                      ".//input[@role='combobox']"
                    ],
                    "method": "setValue",
                    "options": {
                      "triggerKeyDownEvent": true,
                      "triggerFocusEvent": true,
                      "triggerFocusInEvent": true,
                      "triggerBlurEvent": false,
                      "wait": 300
                    }
                  },
                  {
                    "path": [
                      "//div[@data-ownerid=//div[@id='remoteGeoStatePreferences']//label[input[@role='combobox']]/@id]//ul"
                    ],
                    "method": "clickOption",
                    "options": {
                      "waitForNetworkBeforeInteraction": true
                    }
                  }
                ]
              },
              {
                "keywords": [
                  "state"
                ]
              }
            ]
          ]
        },
        {
          "keywords": [
            "state"
          ]
        }
      ]
    ],
    "alwaysSyncWindowId": true,
    "screenshot": {
      "hide": []
    }
  },
  "oraclecloud": {
    "atsName": "oraclecloud",
    "urls": [
      "*://*.com/hcmUI/CandidateExperience/en/sites/CX*/job/*/apply",
      "*://*.com/hcmUI/CandidateExperience/en/sites/CX*/apply",
      "*://*.fa.*.oraclecloud.com/hcmUI/CandidateExperience/es/sites/*/job/*/apply",
      "*://*.fa.oraclecloud.com/hcmUI/CandidateExperience/en/sites/*/job/*/apply",
      "*://*.fa.*.oraclecloud.com/hcmUI/CandidateExperience/*/sites/CX*/job/*/easy-apply/*",
      "*://*.fa.*.oraclecloud.com/hcmUI/CandidateExperience/*/sites/*/jobs/preview/*/apply/*"
    ],
    "globalOptions": {
      "waitForAllRequestsBeforeFillingStep": true,
      "waitForInteractionNetworkRequests": true
    },
    "validationErrorPersistent": true,
    "formLoadingAfterNextStepClick": true,
    "formLoadingXPaths": [
      "//indeterminate-progress-bar/div[contains(@class, 'indeterminate-progress-bar')]",
      "//div[contains(@class, 'checklist__progress') and count(.//oj-progress-bar) > 1]"
    ],
    "loadingSpinnerXPath": [
      "//div[@class='app-loading-spinner']"
    ],
    "detectPageQuestions": true,
    "highPriority": [
      "country",
      "addressLine1",
      "city",
      "state",
      "county",
      "postalCode"
    ],
    "lowPriorityEntities": [
      "resume"
    ],
    "monitorSubmitFlow": true,
    "formLoadingAfterSubmitClick": true,
    "verificationAfterSubmit": true,
    "expiredJob": [
      {
        "container": [
          ".//h1",
          ".//h2"
        ],
        "keywords": [
          "current openings",
          "current job openings",
          "no current openings.",
          "open positions",
          "no longer available"
        ]
      }
    ],
    "networkOptions": {
      "blacklistedUrlParts": [
        "linkedin",
        "analytics",
        "insights",
        "doubleclick",
        "track",
        "trackings",
        "drafts",
        "mapviewer",
        "blob"
      ]
    },
    "urlsExclude": [],
    "exitModalWindow": [
      ".//button[contains(@data-qa, 'addTileItemDialogButton')]"
    ],
    "submitButtonPaths": [
      ".//button[contains(@class, 'button apply-flow-pagination__button') and not(@data-qa='applyFlowPaginationNextButton') and not(@title='Back') and .//span[contains(@class, 'button__label') and normalize-space(text()) = 'Submit']]"
    ],
    "nextStepButtonPaths": [
      ".//button[contains(@class, 'button apply-flow-pagination__button') and @data-qa='applyFlowPaginationNextButton']",
      "//button[contains(@class, 'apply-flow-pagination__button') and not(contains(translate(@aria-label, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'back')) and not(contains(translate(@aria-label, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'cancel'))]",
      ".//button[contains(@class, 'apply-flow-dialog__button') and @type='submit' and .//span[contains(@class, 'button__label') and normalize-space(text()) = 'Verify']]",
      ".//button[contains(@id, 'applyFlowLegalDisclaimer')]",
      "//a[contains(@class, 'quick-apply-flow__manually--link')]"
    ],
    "validationErrorXPaths": [
      ".//div[contains(@class, 'dijitError')]",
      ".//input[contains(@class, 'dijitError')]",
      ".//table[contains(@class, 'dijitError')]",
      ".//div[contains(@class, 'docUploadLocalError')]",
      ".//p[@role='alert' and contains(@data-bind, 'getError')]",
      ".//p[@role='alert' and contains(@class, 'input-row__validation')]"
    ],
    "errorBannerXPaths": [
      "//button[contains(@class, 'apply-flow-fixer__button')][.//span[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'view error')]]"
    ],
    "clickErrorBannerAfterFailedSubmit": true,
    "waitForSubmitOutcome": true,
    "checkVerificationAfterSubmit": true,
    "targetNodeXPath": [
      ".//form[@class='apply-flow__content']",
      ".//div[contains(@class,'job-details-page-container')]",
      ".//section[contains(@class, 'apply-flow__content')]",
      ".//span[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'view error')]"
    ],
    "verificationRequired": {
      "errorXPath": [
        "//h1[contains(translate(normalize-space(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'confirm') and contains(translate(normalize-space(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'identity')]",
        "//button[contains(translate(@data-bind,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'verify') and .//span[contains(translate(normalize-space(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'verify')]]"
      ]
    },
    "questionValidationErrorSelectors": [
      "[class*='validation-error']",
      "[class*='row__validation']"
    ],
    "confirmSubmittedForm": {
      "urls": [
        "my-profile"
      ],
      "confirmMessageXPath": [
        "//h1[contains(translate(normalize-space(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'thank you for applying')]",
        "//div[contains(translate(normalize-space(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'has been submitted')]"
      ]
    },
    "questionsInSubmitPage": true,
    "alwaysSyncWindowId": true,
    "targetFrameNodeXPath": [],
    "customQuestions": {
      "patterns": {
        "questionId": "input-"
      },
      "selectors": {
        "title": "h2",
        "label": "label",
        "labelInputGroup": ".apply-flow-input-radio__label, .apply-flow-input-checkbox__label, .cx-select-pill-name",
        "question": "input[type='text'], input[aria-required='true'], textarea[class],input[aria-label='${label.textContent}'], div[role='radiogroup'], div[role='group'], div[class*='has-picker']:not([class*='geo-hierarchy'])",
        "ariaLabelledBy": "[aria-labelledby*=__labelId__]",
        "roleOption": "[role='option']",
        "radioInput": "input[type='radio']",
        "monthInput": "input[aria-valuetext='MM']",
        "dateInput": "input[aria-valuetext='DD']",
        "yearInput": "input[aria-valuetext='YYYY']",
        "checkbox": "span[class='apply-flow-input-checkbox__button'], span[class='cx-select-pill-name']",
        "optionsSelector": ".apply-flow-input-radio, .apply-flow-input-checkbox, li[role='listitem'] button",
        "questionParent": ".input-row-composite__inputs",
        "formGroup": ".input-row__control-container",
        "mapOption": "[role='row'], [role='presentation'] > div, li[role='option'] > div",
        "contextSelector": "span[class='input-field__label']"
      },
      "xpaths": {
        "currentListItem": [],
        "listInputBackBtnText": [],
        "selectPopupXPath": [],
        "listBoxPopupXPath": [],
        "selectedItemListXPath": [],
        "requiredFieldXPath": [
          "//span[contains(@class, 'required')]"
        ]
      },
      "ignoreQuestions": [
        ".//input[contains(@aria-label, 'Veteran Discharge Date')]",
        "//div[@class='oj-text-field-middle']//span[text()='Day']/ancestor::oj-label/following-sibling::input",
        "//div[@class='oj-text-field-middle']//span[text()='Month']/ancestor::oj-label/following-sibling::input",
        ".//input[contains(@aria-label, 'TERRITORIES')]",
        ".//input[contains(@aria-label, 'TERRITORIES')]/ancestor::div[2]/following-sibling::oj-input-text//input",
        "//div[label[contains(translate(normalize-space(.), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'country')]]//input[contains(@id, 'filter')]",
        ".//input[starts-with(@aria-label, 'State')]/ancestor::div[2]/following-sibling::oj-input-text//input",
        ".//input[contains(@aria-label, 'TERRITORIES')]/ancestor::div[2]/following-sibling::oj-input-text//input",
        "//div[label[contains(translate(normalize-space(.), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'state')]]//input[contains(@id, 'filter')]",
        "//input[@name='region2']",
        ".//input[starts-with(@aria-label, 'State') and contains(@id, 'filter')]",
        ".//input[starts-with(translate(@aria-label, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'county')]",
        "//input[@name='region1']",
        ".//input[starts-with(translate(@aria-label, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'city')]/ancestor::div[2]/following-sibling::oj-input-text//input",
        "//input[@name='city']",
        "//div[label[contains(translate(normalize-space(.), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'city')]]//input[contains(@id, 'filter')]",
        ".//input[starts-with(translate(@aria-label, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'zip code')]/ancestor::div[2]/following-sibling::oj-input-text//input",
        ".//input[starts-with(translate(@aria-label, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'postal code')]/ancestor::div[2]/following-sibling::oj-input-text//input",
        "//input[@name='postalCode']",
        "//div[contains(@class, 'input-row--has-picker') and .//label[contains(., 'Phone')]]",
        "//input[@name='phoneNumber']"
      ]
    },
    "jobXPaths": {
      "entities": [
        [
          "titleDisplay",
          [
            ".//h1[contains(@class, 'job-details__title')]"
          ]
        ],
        [
          "originalCompanyName",
          [
            "//meta[contains(@property, 'site_name')]/@content"
          ]
        ],
        [
          "jobTypes",
          []
        ],
        [
          "postingDate",
          []
        ],
        [
          "locationDisplay",
          [
            ".//span[contains(@data-bind, 'postingLocationsContent')]"
          ]
        ],
        [
          "url",
          []
        ],
        [
          "desc",
          [
            ".//div[contains(@class, 'job-details__description-content')]"
          ]
        ]
      ]
    },
    "canJobBeAppliedXPaths": {
      "applyButton": [
        ".//button[contains(@class, 'apply-now-button') and not(@disabled) and not(contains(@class, 'already-applied'))]"
      ]
    },
    "contextData": {
      "classifier": {
        "applyBtnPath": [
          "//a[contains(@href, 'oraclecloud.com') and CONTAINS_TEXT('apply', true)]",
          "//a[contains(@data-apply-url, 'oraclecloud.com') and CONTAINS_TEXT('apply', true)]"
        ]
      },
      "options": {}
    },
    "preApply": {
      "urls": [
        "*://*.fa.oraclecloud.com/hcmUI/CandidateExperience/en/sites/*/job/*",
        "*://*.fa.*.oraclecloud.com/hcmUI/CandidateExperience/en/sites/*/job/*",
        "*://*.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/*/sites/*/job/*"
      ],
      "entities": [
        [
          "cookieConsent",
          {
            "actions": [
              {
                "path": [
                  "//button[@id='onetrust-accept-btn-handler']"
                ],
                "method": "click"
              }
            ]
          }
        ],
        [
          "applyBtn",
          {
            "actions": [
              {
                "key": "canJobBeAppliedXPaths.applyButton",
                "method": "click",
                "time": 500
              }
            ]
          }
        ]
      ],
      "continueFilling": true
    },
    "signIn": {
      "urls": [],
      "submitButton": [],
      "createAccount": [],
      "forgotPassword": [],
      "email": [],
      "password": [],
      "errorMessage": [],
      "endpoint": ""
    },
    "signUp": {
      "errorMessage": [],
      "submitButton": [],
      "email": [],
      "password": [],
      "verifyPassword": [],
      "endpoint": ""
    },
    "verification": {
      "enabled": true,
      "interval": 15000,
      "maxDuration": 120000,
      "codeConfig": [
        {
          "type": "segments",
          "inputs": [
            "//input[contains(translate(@aria-label, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'verification code')]"
          ],
          "confirmButton": [
            "//button[CONTAINS_TEXT('verify', true)]"
          ]
        }
      ]
    },
    "entities": [
      [
        "email",
        {
          "actions": [
            {
              "path": [
                ".//input[starts-with(@name, 'emailAddress') or @id='guestEmail' or contains(@id, 'primary-email')]"
              ],
              "method": "setValue",
              "options": {
                "waitForNetworkBeforeInteraction": true,
                "waitForElementTimeout": 3500
              }
            }
          ]
        },
        {
          "keywords": [
            "email",
            "apply"
          ]
        }
      ],
      [
        "privacyAgreement",
        {
          "actions": [
            {
              "path": [
                "//span[contains(@class, 'apply-flow-input-checkbox__button') and contains(@data-bind, 'legalDisclaimer') and not(contains(@class, 'hide'))]",
                "//button[contains(@id, 'applyFlowLegalDisclaimer') and contains(@data-bind, 'acceptance') and not(contains(@class, 'hide'))]"
              ],
              "method": "click",
              "options": {
                "waitForNetworkAfterInteraction": true
              },
              "time": 750
            }
          ]
        },
        {
          "keywords": [
            "privacy agreement",
            "legal disclaimer",
            "terms and conditions",
            "apply",
            "i agree",
            "have an account",
            "communicate",
            "get started"
          ]
        }
      ],
      [
        "verification",
        {
          "actions": [
            {
              "method": "checkVerificationRequired"
            }
          ]
        },
        {
          "keywords": [
            "confirm your identity",
            "verify",
            "verification code"
          ]
        }
      ],
      [
        "lastName",
        {
          "actions": [
            {
              "path": [
                ".//input[starts-with(@name, 'lastName')]",
                "//input[@id='guestLastName']"
              ],
              "method": "setValue",
              "options": {
                "waitForNetworkBeforeInteraction": true
              }
            }
          ]
        },
        {
          "keywords": [
            "last name",
            "surname",
            "family name"
          ]
        }
      ],
      [
        "firstName",
        {
          "actions": [
            {
              "path": [
                ".//input[starts-with(@name, 'firstName')]",
                "//input[@id='guestFirstName']"
              ],
              "method": "setValue",
              "options": {
                "waitForNetworkBeforeInteraction": true
              }
            }
          ]
        },
        {
          "keywords": [
            "first name"
          ]
        }
      ],
      [
        "preferredFirstName",
        {
          "actions": [
            {
              "path": [
                ".//input[contains(@name, 'knownAs')]"
              ],
              "method": "setValue",
              "options": {
                "waitForNetworkBeforeInteraction": true,
                "waitForNetworkAfterInteraction": true
              },
              "time": 750
            }
          ]
        },
        {
          "keywords": [
            "preferred name"
          ]
        }
      ],
      [
        "phoneCode",
        {
          "actions": [
            {
              "path": [
                ".//label[contains(., 'Country code')]/../../following-sibling::*[1]",
                "//input[@id='country-codes-dropdownphoneNumber']"
              ],
              "method": "click",
              "options": {
                "checkElementVisibility": true,
                "waitForNetworkBeforeInteraction": true,
                "waitForNetworkAfterInteraction": true
              },
              "time": 500
            },
            {
              "path": [
                "//oj-label[.//span[text()='Country code']]/following-sibling::input",
                "//input[@id='country-codes-dropdownphoneNumber']"
              ],
              "method": "setValue",
              "defaultValue": "+1 (United States)",
              "options": {
                "triggerBlurEvent": false,
                "resetValue": true,
                "triggerChangeEvent": true,
                "triggerKeyDownEvent": true,
                "triggerKeyUpEvent": true,
                "triggerInputEvent": true,
                "waitForNetworkAfterInteraction": true,
                "waitForNetworkBeforeInteraction": true,
                "optionMapper": true
              }
            },
            {
              "path": [
                "//ul[@role='grid'][li[contains(@class, 'listview-item')]]",
                "//div[contains(@id, 'country-codes-dropdownphoneNumber') and contains(@class, 'options')]//div"
              ],
              "method": "clickOption",
              "options": {
                "forceOptionSearch": true,
                "defaultValue": "+1 (United States)",
                "waitForNetworkBeforeInteraction": true
              },
              "time": 750
            }
          ]
        },
        {
          "keywords": [
            "phone code",
            "country code"
          ]
        }
      ],
      [
        "phoneStripped",
        {
          "actions": [
            {
              "path": [
                ".//input[contains(@class, 'phone-row__input')]"
              ],
              "method": "setValue",
              "options": {
                "waitForNetworkAfterInteraction": true,
                "waitForNetworkBeforeInteraction": true
              },
              "time": 500
            }
          ]
        },
        {
          "keywords": [
            "phone"
          ]
        }
      ],
      [
        "addressType",
        {
          "actions": [
            {
              "path": [
                ".//select[contains(@id, 'PersonProfileFields.AddressType')]"
              ],
              "method": "clickOption",
              "values": {
                "home": [
                  "Home"
                ]
              },
              "options": {
                "checkElementVisibility": true
              }
            }
          ]
        }
      ],
      [
        "workAuth",
        {
          "actions": [
            {
              "path": [
                "//input[not(contains(@aria-label, 'sponsorship')) and (contains(@aria-label, 'work') and (contains(@aria-label, 'authorized') or contains(@aria-label, 'permitted') or contains(@aria-label, 'eligible') or contains(@aria-label, 'lawfully') or contains(@aria-label, 'legally') or contains(@aria-label, 'right'))) and contains(@id, 'filter')]"
              ],
              "method": "click",
              "options": {
                "checkElementVisibility": true,
                "waitForNetworkAfterInteraction": true
              }
            },
            {
              "path": [
                "//ul[@role='grid'][li[contains(@class, 'listview-item')] and @role='grid']"
              ],
              "method": "clickOption",
              "options": {
                "containerElement": "document",
                "waitForNetworkBeforeInteraction": true
              },
              "values": {
                "true": [
                  "Yes",
                  "I am authorized to work"
                ],
                "false": [
                  "No",
                  "I require sponsorship to work"
                ]
              }
            }
          ]
        },
        {
          "keywords": [
            "work authorization",
            "right to work",
            "authorized",
            "permitted",
            "eligible"
          ]
        }
      ],
      [
        "sponsorship",
        {
          "actions": [
            {
              "path": [
                "//div[@role='radiogroup' and .//label[contains(normalize-space(.), 'require sponsorship')]]"
              ],
              "method": "clickOption",
              "options": {
                "containerElement": "document",
                "waitForNetworkBeforeInteraction": true
              },
              "values": {
                "true": [
                  "Yes",
                  "I am authorized to work"
                ],
                "false": [
                  "No",
                  "I require sponsorship to work"
                ]
              }
            }
          ]
        },
        {
          "keywords": [
            "sponsorship"
          ]
        }
      ],
      [
        "answerSource",
        {
          "actions": [
            {
              "path": [
                "//input[not(contains(translate(@style, 'HIDEN', 'hiden'), 'hidden')) and (contains(translate(@aria-label, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'how did you hear about this job') or contains(translate(@aria-label, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'how did you hear about us') or contains(translate(@aria-label, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'how did you first find out') or contains(translate(@aria-label, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'source') or contains(translate(@aria-label, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'how did you find out about this position'))] | //div[contains(@class, 'input-row') and .//span[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'how you heard about this job')]]//input[not(contains(@style, 'display: none'))]",
                "//input[contains(@aria-label, 'How did you hear about') and contains(@id, 'filter')]",
                "//button[contains(@aria-label, 'How did you hear about us?')]/ancestor::div[contains(@class, 'input-field-container')]//input"
              ],
              "method": "click",
              "options": {
                "waitForNetworkAfterInteraction": true
              }
            },
            {
              "path": [
                "//ul[@role='grid'][li[contains(@class, 'listview-item')]]",
                "//div[contains(@class, 'option')]",
                "//ul[@aria-label='How did you hear about this opportunity?']"
              ],
              "method": "clickOption",
              "values": {
                "source": [
                  "Other",
                  "Google",
                  "Email, Text or Other Marketing",
                  "Personal Network",
                  "Job Fair",
                  "Career Fair",
                  "Give \u201cOther\u201d Explanation",
                  "Website"
                ]
              },
              "options": {
                "lowPriority": [
                  "Indeed",
                  "ZipRecruiter",
                  "LinkedIn",
                  "Glassdoor",
                  "Simplyhired",
                  "Dice",
                  "CareerBuilder",
                  "Monster"
                ],
                "prohibited": [
                  "referral",
                  "referred",
                  "connection",
                  "at the company",
                  "for the organization",
                  "employee",
                  "select",
                  "current worker"
                ],
                "ignoreFirst": true,
                "selectFirstExcludingProhibited": true,
                "waitForNetworkBeforeInteraction": true
              },
              "time": 750
            },
            {
              "path": [
                "//div[contains(@class, 'input-row') and .//label/span[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'please specify')]]//textarea[not(@aria-hidden='true')]",
                "//div[contains(@class, 'input-row') and .//span[contains(text(), 'Please explain further.')]]//textarea[not(contains(@style, 'display: none'))]",
                "//label[contains(translate(normalize-space(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'please specify') or contains(translate(normalize-space(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'if you selected other') or contains(translate(normalize-space(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'explanation')]/ancestor::div[contains(@class, 'input-row')]//textarea"
              ],
              "method": "setValue",
              "defaultValue": "Job Board",
              "options": {
                "triggerBlurEvent": false,
                "waitForNetworkBeforeInteraction": true
              }
            }
          ]
        },
        {
          "keywords": [
            "how did you hear"
          ]
        }
      ],
      [
        "race",
        {
          "actions": [
            {
              "path": [
                "//div[contains(@class, 'input-row')][.//label[contains(., 'race') and contains(., 'identify')]]"
              ],
              "method": "clickOptionWithMultiAnswers",
              "values": {
                "Black or African American": [
                  "Black",
                  "African"
                ],
                "East Asian": [
                  "East Asian",
                  "Asian"
                ],
                "Hispanic or Latino": "Hispanic",
                "Southeast Asian": [
                  "Southeast Asian",
                  "Asian"
                ],
                "South Asian": [
                  "South Asian",
                  "Asian"
                ],
                "Native Hawaiian or Other Pacific Islander": [
                  "Native Hawaiian",
                  "Pacific Islander"
                ],
                "American Indian or Alaska Native": [
                  "American Indian",
                  "Alaskan Native"
                ],
                "White": "White",
                "Two or More Races": "Two or More",
                "Some Other Race": [
                  "Other",
                  "Decline"
                ],
                "Decline to Answer": [
                  "Decline",
                  "Prefer not"
                ],
                "": [
                  "Decline"
                ]
              }
            }
          ]
        },
        {
          "keywords": [
            "race",
            "identify"
          ]
        }
      ],
      [
        "gender",
        {
          "actions": [
            {
              "path": [
                ".//input[contains(@aria-label,'gender') or contains(@aria-label,'Gender')]"
              ],
              "method": "click",
              "options": {
                "checkElementVisibility": true
              }
            },
            {
              "path": [
                ".//div[@id='__ariaOwns__']"
              ],
              "ariaPath": [
                ".//input[contains(@aria-label,'gender') or contains(@aria-label,'Gender')]"
              ],
              "method": "clickOption",
              "values": {
                "Male": [
                  "Male",
                  "Man"
                ],
                "Female": [
                  "Female",
                  "Woman"
                ],
                "I do not want to answer": [
                  "Decline",
                  "I don't wish",
                  "Prefer not"
                ],
                "": [
                  "Decline",
                  "I don't wish",
                  "Prefer not"
                ]
              },
              "options": {
                "containerElement": "document",
                "ariaKey": "ariaOwns"
              },
              "attributes": {
                "ariaOwns": "aria-owns",
                "ariaControls": "aria-controls"
              }
            }
          ]
        },
        {
          "keywords": [
            "gender"
          ]
        }
      ],
      [
        "disability",
        {
          "actions": [
            {
              "path": [
                ".//input[contains(@aria-label, 'disability')]"
              ],
              "method": "click"
            },
            {
              "path": [
                ".//div[@id='__ariaOwns__']",
                "//div[@class='input-row input-row--radiogroup' and @role='radiogroup' and contains(@aria-labelledby,'US-STANDARD-ORA_DISABILITY_STATUS-STANDARD-')]"
              ],
              "ariaPath": [
                ".//input[contains(@aria-label, 'disability')]"
              ],
              "method": "clickOption",
              "values": {
                "true": [
                  "Yes",
                  "I have"
                ],
                "false": [
                  "No",
                  "I do not have",
                  "Prefer not"
                ],
                "": [
                  "Decline",
                  "I don't wish",
                  "Prefer not",
                  "No",
                  "Do not wish"
                ]
              },
              "options": {
                "containerElement": "document",
                "ariaKey": "ariaOwns"
              },
              "attributes": {
                "ariaOwns": "aria-owns",
                "ariaControls": "aria-controls"
              }
            }
          ]
        },
        {
          "keywords": [
            "disability",
            "disabilities"
          ]
        }
      ],
      [
        "veteran",
        {
          "actions": [
            {
              "path": [
                ".//input[contains(@aria-label, 'Military/Reservist') or contains(@aria-label, 'Veteran Status')]"
              ],
              "method": "click",
              "options": {
                "checkElementVisibility": true
              }
            },
            {
              "path": [
                "//ul[@role='grid' and .//text()[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'veteran')]]"
              ],
              "method": "clickOption",
              "values": {
                "true": [
                  "I am a ",
                  "I identify ",
                  "Yes",
                  "Protected"
                ],
                "false": [
                  "I am not a ",
                  "I don't ",
                  "No",
                  "Prefer not",
                  "Not a"
                ],
                "": [
                  "Decline",
                  "I am not a ",
                  "I don't ",
                  "No",
                  "Prefer not",
                  "Decline To Identify"
                ]
              },
              "options": {
                "waitForNetworkBeforeInteraction": true
              }
            }
          ]
        },
        {
          "keywords": [
            "veteran",
            "military",
            "reservist"
          ]
        }
      ],
      [
        "startMonthNameAvailabilityString",
        {
          "actions": [
            {
              "path": [
                "//oj-select-single[@aria-label='What date are you available to begin work? Month']//input[@id]",
                "//oj-select-single[@aria-label='Earliest Available Date Month']//input[contains(@id, 'filter')]",
                "//oj-select-single[contains(@aria-label, 'available to start? Month')]//input[contains(@id, 'filter')]"
              ],
              "method": "click",
              "options": {
                "checkElementVisibility": true,
                "waitForNetworkBeforeInteraction": true,
                "waitForNetworkAfterInteraction": true
              }
            },
            {
              "path": [
                "//ul[@role='grid' and .//text()[contains(., 'January')]]"
              ],
              "method": "clickOption",
              "options": {
                "waitForNetworkBeforeInteraction": true
              }
            }
          ]
        },
        {
          "keywords": [
            "available to begin",
            "available to start"
          ]
        }
      ],
      [
        "startDayAvailabilityString",
        {
          "actions": [
            {
              "path": [
                "//oj-select-single[@aria-label='What date are you available to begin work? Day']//input[@id]",
                "//oj-select-single[@aria-label='Earliest Available Date Day']//input[contains(@id, 'filter')]",
                "//oj-select-single[contains(@aria-label, 'available to start? Day')]//input[contains(@id, 'filter')]"
              ],
              "method": "click",
              "options": {
                "checkElementVisibility": true,
                "waitForNetworkBeforeInteraction": true,
                "waitForNetworkAfterInteraction": true
              }
            },
            {
              "path": [
                "//ul[@role='grid' and .//text()[contains(., '1')]]"
              ],
              "method": "clickOption",
              "options": {
                "waitForNetworkBeforeInteraction": true
              }
            }
          ]
        },
        {
          "keywords": [
            "available to begin",
            "available to start"
          ]
        }
      ],
      [
        "startYearAvailabilityString",
        {
          "actions": [
            {
              "path": [
                "//input[@aria-label='What date are you available to begin work? Year']",
                "//input[@aria-label='Earliest Available Date Year']",
                "//input[@aria-label='What day are you available to start? Year']"
              ],
              "method": "setValue",
              "options": {
                "checkElementVisibility": true,
                "waitForNetworkAfterInteraction": true
              }
            },
            {
              "path": [
                "//ul[@role='grid'][li]"
              ],
              "method": "clickOption",
              "options": {
                "waitForNetworkBeforeInteraction": true
              }
            }
          ]
        },
        {
          "keywords": [
            "available to begin",
            "available to start"
          ]
        }
      ],
      [
        "country",
        {
          "actions": [
            {
              "path": [
                "//div[label[contains(translate(normalize-space(.), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'country')]]//input"
              ],
              "method": "click",
              "options": {
                "waitForElementTimeout": 3000,
                "waitForNetworkBeforeInteraction": true,
                "waitForNetworkAfterInteraction": true
              }
            },
            {
              "path": [
                "//div[label[contains(translate(normalize-space(.), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'country')]]//input[contains(@id, 'filter')]"
              ],
              "method": "setValue",
              "defaultValue": "United States",
              "options": {
                "checkElementVisibility": true,
                "waitForElementTimeout": 3000,
                "waitForNetworkAfterInteraction": true
              }
            },
            {
              "path": [
                "//ul[@role='grid'][li[contains(@class, 'listview-item')]]",
                "//div[contains(@id, 'country') and @role='grid']"
              ],
              "method": "clickOption",
              "options": {
                "containerElement": "document",
                "ariaKey": "ariaOwns"
              },
              "time": 1000
            },
            {
              "path": [
                "//div[label[contains(translate(normalize-space(.), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'country')]]//input"
              ],
              "method": "pressEnterKey",
              "options": {
                "waitForNetworkAfterInteraction": true
              }
            }
          ]
        },
        {
          "keywords": [
            "country",
            "home address"
          ]
        }
      ],
      [
        "addressLine1",
        {
          "actions": [
            {
              "path": [
                ".//input[starts-with(@name, 'addressLine1')]"
              ],
              "method": "setValue",
              "time": 250
            }
          ]
        },
        {
          "keywords": [
            "address line 1",
            "street address",
            "home address"
          ]
        }
      ],
      [
        "state",
        {
          "actions": [
            {
              "path": [
                ".//input[starts-with(@aria-label, 'State')]",
                ".//input[starts-with(@aria-label, 'State') and contains(@id,'search')]",
                ".//input[contains(@aria-label, 'TERRITORIES') and contains(@id,'search')]",
                "//div[label[contains(translate(normalize-space(.), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'state')]]//input",
                "//input[@name='region2']"
              ],
              "method": "click",
              "options": {
                "checkElementVisibility": true,
                "waitForNetworkAfterInteraction": true,
                "checkForValue": true
              }
            },
            {
              "path": [
                ".//input[starts-with(@aria-label, 'State')]/ancestor::div[2]/following-sibling::oj-input-text//input",
                ".//input[contains(@aria-label, 'TERRITORIES')]/ancestor::div[2]/following-sibling::oj-input-text//input",
                "//div[label[contains(translate(normalize-space(.), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'state')]]//input[contains(@id, 'filter')]",
                "//input[@name='region2']"
              ],
              "method": "setValue",
              "options": {
                "resetValue": true,
                "waitForNetworkBeforeInteraction": true,
                "waitForElementTimeout": 3000,
                "trackQuestion": true
              }
            },
            {
              "path": [
                ".//input[starts-with(@aria-label, 'State')]",
                ".//input[starts-with(@aria-label, 'State') and contains(@id,'search')]",
                ".//input[contains(@aria-label, 'TERRITORIES') and contains(@id,'search')]",
                "//div[label[contains(translate(normalize-space(.), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'state')]]//input[contains(@id, 'filter')]",
                "//input[@name='region2']"
              ],
              "method": "click",
              "options": {
                "checkElementVisibility": true,
                "waitForNetworkAfterInteraction": true,
                "checkForValue": true
              },
              "time": 500
            },
            {
              "path": [
                "//ul[@role='grid'][li[contains(@class, 'listview-item')]]",
                "//div[contains(@id, 'region2') and @role='grid']"
              ],
              "method": "clickOption",
              "options": {
                "containerElement": "document",
                "optionMapper": true
              }
            },
            {
              "path": [
                "//div[label[contains(translate(normalize-space(.), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'country')]]//input",
                "//input[@name='region2']"
              ],
              "method": "pressEnterKey",
              "options": {
                "waitForNetworkAfterInteraction": true
              }
            }
          ]
        },
        {
          "keywords": [
            "state",
            "territories",
            "home address"
          ]
        }
      ],
      [
        "stateName",
        {
          "actions": [
            {
              "path": [
                ".//input[starts-with(@aria-label, 'State') and contains(@id, 'filter')]"
              ],
              "method": "click",
              "options": {
                "checkForValue": true
              }
            },
            {
              "path": [
                ".//input[starts-with(@aria-label, 'State') and contains(@id, 'filter')]"
              ],
              "method": "setValue",
              "options": {
                "checkForValue": true,
                "waitForNetworkAfterInteraction": true
              }
            },
            {
              "path": [
                "//ul[@role='grid'][li[contains(@class, 'listview-item')]]"
              ],
              "method": "clickOption",
              "options": {
                "waitForNetworkBeforeInteraction": true,
                "containerElement": "document"
              }
            }
          ]
        },
        {
          "keywords": [
            "state name",
            "home address"
          ]
        }
      ],
      [
        "county",
        {
          "actions": [
            {
              "path": [
                ".//input[starts-with(translate(@aria-label, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'county')]",
                "//input[@name='region1']"
              ],
              "method": "click",
              "options": {
                "checkForValue": true,
                "checkElementVisibility": true
              }
            },
            {
              "path": [
                ".//input[starts-with(translate(@aria-label, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'county')]/ancestor::div[2]/following-sibling::oj-input-text//input",
                "//input[@name='region1']"
              ],
              "method": "getCounty",
              "time": 500,
              "options": {
                "waitForNetworkAfterInteraction": true
              }
            },
            {
              "path": [
                ".//input[starts-with(translate(@aria-label, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'county')]/ancestor::div[2]/following-sibling::oj-input-text//input",
                "//input[@name='region1']"
              ],
              "method": "setValue",
              "options": {
                "resetValue": true,
                "waitForNetworkBeforeInteraction": true,
                "triggerBlurEvent": false,
                "triggerChangeEvent": true
              },
              "time": 500
            },
            {
              "path": [
                ".//input[starts-with(translate(@aria-label, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'county')]",
                "//input[@name='region1']"
              ],
              "method": "click",
              "options": {
                "checkElementVisibility": true,
                "checkForValue": true,
                "waitForNetworkBeforeInteraction": true,
                "waitForNetworkAfterInteraction": true
              },
              "time": 750
            },
            {
              "path": [
                "//ul[@role='grid'][li[contains(@class, 'listview-item')] and @role='grid']",
                "//div[contains(@id, 'region1') and contains(@id,'listbox-container')]"
              ],
              "method": "clickOption",
              "options": {
                "waitForNetworkBeforeInteraction": true,
                "containerElement": "document"
              }
            },
            {
              "path": [
                "//input[@name='region1']"
              ],
              "method": "pressEnterKey"
            }
          ]
        },
        {
          "keywords": [
            "county",
            "region",
            "home address"
          ]
        }
      ],
      [
        "city",
        {
          "actions": [
            {
              "path": [
                ".//input[starts-with(translate(@aria-label, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'city') and not(contains(@style,'hidden'))]",
                "//div[label[contains(translate(normalize-space(.), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'city')]]//input"
              ],
              "method": "click",
              "options": {
                "checkForValue": true,
                "checkElementVisibility": true
              }
            },
            {
              "path": [
                ".//input[starts-with(translate(@aria-label, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'city')]/ancestor::div[2]/following-sibling::oj-input-text//input",
                "//input[@name='city']",
                "//div[label[contains(translate(normalize-space(.), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'city')]]//input[contains(@id, 'filter')]"
              ],
              "method": "setValue",
              "options": {
                "resetValue": true,
                "waitForNetworkBeforeInteraction": true,
                "waitForNetworkAfterInteraction": true,
                "triggerBlurEvent": false,
                "triggerChangeEvent": true,
                "trackQuestion": true
              },
              "time": 500
            },
            {
              "path": [
                ".//input[starts-with(translate(@aria-label, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'city') and not(contains(@style,'hidden'))]",
                "//div[label[contains(translate(normalize-space(.), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'city')]]//input"
              ],
              "method": "click",
              "options": {
                "checkForValue": true,
                "checkElementVisibility": true,
                "waitForNetworkAfterInteraction": true,
                "waitForNetworkBeforeInteraction": true
              },
              "time": 750
            },
            {
              "path": [
                "//ul[@role='grid'][li[contains(@class, 'listview-item')]]",
                "//div[contains(@id, 'city') and @role='grid']"
              ],
              "method": "clickOption",
              "options": {
                "containerElement": "document",
                "waitForNetworkBeforeInteraction": true,
                "optionMapper": true
              }
            },
            {
              "path": [
                "//div[label[contains(translate(normalize-space(.), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'city')]]//input"
              ],
              "method": "pressEnterKey"
            }
          ]
        },
        {
          "keywords": [
            "city",
            "home address"
          ]
        }
      ],
      [
        "postalCode",
        [
          {
            "actions": [
              {
                "path": [
                  "//input[(contains(translate(@aria-label, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'zip code') or contains(translate(@aria-label, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'postal code'))and not(contains(@style,'hidden'))]",
                  "//input[contains(@id, 'postalCode')]"
                ],
                "method": "click",
                "options": {
                  "checkElementVisibility": true,
                  "checkForValue": true
                }
              },
              {
                "path": [
                  ".//input[starts-with(translate(@aria-label, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'zip code')]/ancestor::div[2]/following-sibling::oj-input-text//input",
                  ".//input[starts-with(translate(@aria-label, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'postal code')]/ancestor::div[2]/following-sibling::oj-input-text//input",
                  "//input[@name='postalCode']"
                ],
                "method": "setValue",
                "options": {
                  "triggerKeyDownEvent": true,
                  "triggerKeyUpEvent": true,
                  "triggerInputEvent": true,
                  "triggerBlurEvent": false,
                  "triggerChangeEvent": true,
                  "triggerFocusEvent": true,
                  "triggerFocusInEvent": true,
                  "resetValue": true,
                  "waitForNetworkAfterInteraction": true
                },
                "time": 1000
              },
              {
                "path": [
                  "//input[(contains(translate(@aria-label, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'zip code') or contains(translate(@aria-label, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'postal code'))and not(contains(@style,'hidden'))]",
                  "//input[contains(@id, 'postalCode')]"
                ],
                "method": "click",
                "options": {
                  "checkElementVisibility": true,
                  "triggerKeyDownEvent": true,
                  "triggerKeyUpEvent": true,
                  "triggerInputEvent": true,
                  "triggerBlurEvent": false,
                  "triggerChangeEvent": true,
                  "waitForNetworkAfterInteraction": true
                },
                "time": 750
              },
              {
                "path": [
                  "//ul[@role='grid'][li[contains(@class, 'listview-item')]]",
                  "//div[contains(@id, 'postalCode') and @role='grid']"
                ],
                "method": "clickOption",
                "options": {
                  "containerElement": "document",
                  "waitForNetworkBeforeInteraction": true
                }
              },
              {
                "path": [
                  "//input[contains(@id, 'postalCode')]"
                ],
                "method": "pressEnterKey"
              }
            ]
          },
          {
            "actions": [
              {
                "path": ".//input[starts-with(@aria-label, 'Postal') and not(contains(@id,'search'))]",
                "method": "setValue"
              }
            ]
          }
        ],
        {
          "keywords": [
            "postal code",
            "zip code",
            "zipcode",
            "home address"
          ]
        }
      ],
      [
        "reference",
        {
          "actions": [
            {
              "path": [
                "//div[contains(., 'Reference')]//textarea[1]"
              ],
              "method": "setValueMultiple"
            }
          ]
        },
        {
          "keywords": [
            "reference"
          ]
        }
      ],
      [
        "fullName",
        [
          ".//input[contains(@id, 'fullName') and @name='fullName' and not(contains(@style, 'hidden'))]"
        ],
        {
          "keywords": [
            "full name"
          ]
        }
      ],
      [
        "experience",
        {
          "addButtonPath": [
            ".//div[contains(@aria-label, 'Experience  Please provide details about your work experience.')]/button",
            "//button[not(contains(@class, 'save-btn')) and not(@disabled) and .//span[contains(text(), 'Experience') and not(contains(text(), 'Government'))]]",
            "//button[contains(@id, 'profileItemsAddButton') and not(@disabled) and not(contains(@data-bind, 'validation'))]//span[normalize-space(text())='Add Experience']",
            "//button[contains(@id, 'timeline-add-experience-button') and not(@disabled) and not(contains(@data-bind, 'validation'))]//span[normalize-space(text())='Add Experience']"
          ],
          "containerPath": [
            ".//oj-dialog[contains(@aria-label,'Add Work History')]//div[contains(@class, 'dialog-body') and contains(@class, 'main') and not(contains(@class, 'wrapper'))]",
            "//timeline-form-inline[.//timeline-form-builder[.//*[contains(text(), 'Employer') or contains(text(), 'Job')]]]",
            "//div[contains(@class, 'profile-items')][.//*[contains(text(), 'Employer') or contains(text(), 'Job')]]"
          ],
          "confirmAddedPath": [
            ".//button[contains(@data-qa, 'addTileItemDialogButton')]"
          ],
          "entryContainer": {
            "title": [
              "//div[contains(@aria-label, 'experience')]//button//div[contains(@class, 'summary-title')]",
              "//beautiful-timeline-item[contains(@params, 'experience')]//span[contains(@class, 'item__title')]"
            ],
            "subtitle": [
              "//div[contains(@aria-label, 'experience')]//button//div[contains(@class, 'summary-subtitle')]",
              "//beautiful-timeline-item[contains(@params, 'experience')]//span[contains(@class, 'item__subtitle')]"
            ]
          },
          "time": 1500,
          "entities": [
            [
              "title",
              [
                ".//input[starts-with(@name, 'jobTitle')]"
              ],
              {
                "keywords": [
                  "title"
                ]
              }
            ],
            [
              "companyName",
              [
                ".//input[starts-with(@name, 'employerName')]"
              ],
              {
                "keywords": [
                  "employer name",
                  "company name"
                ]
              }
            ],
            [
              "description",
              [
                ".//textarea[starts-with(@name, 'responsibilities')]",
                ".//textarea[@name='achievements']"
              ],
              {
                "keywords": [
                  "description",
                  "responsibilities",
                  "function",
                  "achievements"
                ]
              }
            ],
            [
              "reasonLeaving",
              [
                ".//textarea[starts-with(@name, 'leavingReason')]"
              ],
              {
                "keywords": [
                  "reason for leaving",
                  "reason for departure"
                ]
              }
            ],
            [
              "startDateMonthText",
              {
                "actions": [
                  {
                    "path": [
                      ".//label[contains(., 'Start Date')]/../following-sibling::*[1]//input[contains(@class,'oj-searchselect-input oj-text-field-input')]",
                      ".//div[contains(@class, 'datepicker-row') and .//span[normalize-space() = 'Start Date']]//input[contains(@id,'month-startDate')]",
                      ".//input[contains(@id, 'month-startDate')]"
                    ],
                    "method": "click",
                    "time": 500,
                    "options": {
                      "preventClickIfEmpty": true
                    }
                  },
                  {
                    "path": [
                      ".//label[contains(., 'Start Date')]/../following-sibling::*[1]//input[contains(@class,'oj-searchselect-input oj-text-field-input')]"
                    ],
                    "method": "setValue",
                    "options": {
                      "triggerBlurEvent": false,
                      "triggerChangeEvent": true
                    }
                  },
                  {
                    "path": [
                      "//ul[@role='grid'][li]",
                      ".//div[contains(@id,'month-startDate') and contains(@id,'listbox-container')]"
                    ],
                    "method": "clickOption",
                    "options": {
                      "containerElement": "document"
                    },
                    "values": {
                      "January": [
                        "Jan",
                        "January",
                        "01"
                      ],
                      "February": [
                        "Feb",
                        "February",
                        "02"
                      ],
                      "March": [
                        "Mar",
                        "March",
                        "03"
                      ],
                      "April": [
                        "Apr",
                        "April",
                        "04"
                      ],
                      "May": [
                        "May",
                        "05"
                      ],
                      "June": [
                        "Jun",
                        "June",
                        "06"
                      ],
                      "July": [
                        "Jul",
                        "July",
                        "07"
                      ],
                      "August": [
                        "Aug",
                        "August",
                        "08"
                      ],
                      "September": [
                        "Sep",
                        "September",
                        "09"
                      ],
                      "October": [
                        "Oct",
                        "October",
                        "10"
                      ],
                      "November": [
                        "Nov",
                        "November",
                        "11"
                      ],
                      "December": [
                        "Dec",
                        "December",
                        "12"
                      ]
                    }
                  }
                ]
              },
              {
                "keywords": [
                  "start date",
                  "month",
                  "date from"
                ]
              }
            ],
            [
              "startDateYear",
              {
                "actions": [
                  {
                    "path": [
                      ".//input[@type='text' and contains(@aria-label, 'Start Date Year')]",
                      ".//div[contains(@class, 'datepicker-row') and .//span[normalize-space() = 'Start Date']]//input[contains(@id,'year-startDate')]",
                      ".//input[contains(@id, 'year-startDate')]"
                    ],
                    "method": "click",
                    "options": {
                      "preventClickIfEmpty": true,
                      "waitForNetworkAfterInteraction": true
                    },
                    "time": 500
                  },
                  {
                    "path": [
                      ".//input[@type='text' and contains(@aria-label, 'Start Date Year')]",
                      ".//div[contains(@class, 'datepicker-row') and .//span[normalize-space() = 'Start Date']]//input[contains(@id,'year-startDate')]"
                    ],
                    "method": "setValue",
                    "options": {
                      "triggerKeyDownEvent": true,
                      "triggerKeyUpEvent": true,
                      "triggerInputEvent": true,
                      "triggerBlurEvent": false,
                      "triggerChangeEvent": true,
                      "triggerFocusEvent": true,
                      "triggerFocusInEvent": true
                    },
                    "time": 750
                  },
                  {
                    "path": [
                      ".//div[contains(@id,'year-startDate') and @role='grid']"
                    ],
                    "method": "clickOption",
                    "time": 500
                  },
                  {
                    "path": [
                      ".//input[@type='text' and contains(@aria-label, 'Start Date Year')]"
                    ],
                    "method": "click",
                    "time": 500
                  }
                ]
              },
              {
                "keywords": [
                  "start date",
                  "year",
                  "date from"
                ]
              }
            ],
            [
              "endDateMonthText",
              {
                "actions": [
                  {
                    "path": [
                      ".//label[contains(., 'End Date')]/../following-sibling::*[1]//input[contains(@class,'oj-searchselect-input oj-text-field-input')]",
                      ".//input[contains(@id,'month-endDate')]"
                    ],
                    "method": "click",
                    "options": {
                      "waitForNetworkAfterInteraction": true,
                      "preventClickIfEmpty": true
                    },
                    "time": 500
                  },
                  {
                    "path": [
                      ".//label[contains(., 'End Date')]/../following-sibling::*[1]//input[contains(@class,'oj-searchselect-input oj-text-field-input')]"
                    ],
                    "method": "setValue",
                    "options": {
                      "triggerBlurEvent": false,
                      "triggerChangeEvent": true,
                      "triggerInputEvent": true,
                      "triggerFocusEvent": true,
                      "triggerFocusInEvent": true
                    }
                  },
                  {
                    "path": [
                      ".//div[contains(@id,'month-endDate') and contains(@id,'listbox-container')]"
                    ],
                    "method": "clickOption",
                    "values": {
                      "January": [
                        "Jan",
                        "January",
                        "01"
                      ],
                      "February": [
                        "Feb",
                        "February",
                        "02"
                      ],
                      "March": [
                        "Mar",
                        "March",
                        "03"
                      ],
                      "April": [
                        "Apr",
                        "April",
                        "04"
                      ],
                      "May": [
                        "May",
                        "05"
                      ],
                      "June": [
                        "Jun",
                        "June",
                        "06"
                      ],
                      "July": [
                        "Jul",
                        "July",
                        "07"
                      ],
                      "August": [
                        "Aug",
                        "August",
                        "08"
                      ],
                      "September": [
                        "Sep",
                        "September",
                        "09"
                      ],
                      "October": [
                        "Oct",
                        "October",
                        "10"
                      ],
                      "November": [
                        "Nov",
                        "November",
                        "11"
                      ],
                      "December": [
                        "Dec",
                        "December",
                        "12"
                      ]
                    },
                    "options": {
                      "containerElement": "document"
                    }
                  },
                  {
                    "path": [
                      "//ul[@role='grid' and .//text()[contains(., 'January') or contains(., 'February') or contains(., 'March') or contains(., 'April') or contains(., 'May') or contains(., 'June') or contains(., 'July') or contains(., 'August') or contains(., 'September') or contains(., 'October') or contains(., 'November') or contains(., 'December')]]"
                    ],
                    "method": "clickOption",
                    "values": {
                      "January": [
                        "Jan",
                        "January",
                        "01"
                      ],
                      "February": [
                        "Feb",
                        "February",
                        "02"
                      ],
                      "March": [
                        "Mar",
                        "March",
                        "03"
                      ],
                      "April": [
                        "Apr",
                        "April",
                        "04"
                      ],
                      "May": [
                        "May",
                        "05"
                      ],
                      "June": [
                        "Jun",
                        "June",
                        "06"
                      ],
                      "July": [
                        "Jul",
                        "July",
                        "07"
                      ],
                      "August": [
                        "Aug",
                        "August",
                        "08"
                      ],
                      "September": [
                        "Sep",
                        "September",
                        "09"
                      ],
                      "October": [
                        "Oct",
                        "October",
                        "10"
                      ],
                      "November": [
                        "Nov",
                        "November",
                        "11"
                      ],
                      "December": [
                        "Dec",
                        "December",
                        "12"
                      ]
                    }
                  }
                ]
              },
              {
                "keywords": [
                  "end date",
                  "month",
                  "date to"
                ]
              }
            ],
            [
              "endDateYear",
              {
                "actions": [
                  {
                    "path": [
                      ".//input[@type='text' and contains(@aria-label, 'End Date Year')]",
                      ".//input[contains(@id,'year-endDate')]"
                    ],
                    "method": "click",
                    "time": 500,
                    "options": {
                      "waitForNetworkAfterInteraction": true,
                      "preventClickIfEmpty": true
                    }
                  },
                  {
                    "path": [
                      ".//input[@type='text' and contains(@aria-label, 'End Date Year')]",
                      ".//input[contains(@id,'year-endDate')]"
                    ],
                    "method": "setValue",
                    "options": {
                      "triggerKeyDownEvent": true,
                      "triggerKeyUpEvent": true,
                      "triggerInputEvent": true,
                      "triggerBlurEvent": false,
                      "triggerChangeEvent": true,
                      "triggerFocusEvent": true,
                      "triggerFocusInEvent": true
                    },
                    "time": 750
                  },
                  {
                    "path": [
                      ".//div[contains(@id,'year-endDate') and @role='grid']"
                    ],
                    "method": "clickOption",
                    "time": 500
                  },
                  {
                    "path": [
                      ".//input[@type='text' and contains(@aria-label, 'End Date Year')]"
                    ],
                    "method": "click",
                    "time": 500
                  }
                ]
              },
              {
                "keywords": [
                  "end date",
                  "year",
                  "date to"
                ]
              }
            ],
            [
              "country",
              {
                "actions": [
                  {
                    "path": [
                      ".//input[contains(@aria-label, 'Employer Country') and not(contains(@style, 'visibility: hidden'))]",
                      ".//input[contains(@id, 'countryCode')]"
                    ],
                    "method": "click",
                    "options": {
                      "waitForNetworkAfterInteraction": true
                    }
                  },
                  {
                    "path": [
                      ".//div[contains(@class, 'input-row__control-container')]//input[@aria-label='Employer Country' and @type='text' and contains(@id, 'filter') and not(contains(@style, 'visibility: hidden'))]",
                      ".//input[contains(@id, 'countryCode')]"
                    ],
                    "method": "setValueSearchElement",
                    "defaultValue": "United States",
                    "options": {
                      "triggerBlurEvent": false,
                      "triggerChangeEvent": true,
                      "waitForNetworkAfterInteraction": true,
                      "waitForNetworkBeforeInteraction": true
                    }
                  },
                  {
                    "path": [
                      "//ul[@role='grid'][li]",
                      ".//div[contains(@id, 'countryCode') and contains(@id,'listbox-container')]"
                    ],
                    "method": "clickOption",
                    "options": {
                      "waitForNetworkBeforeInteraction": true,
                      "waitForNetworkAfterInteraction": true,
                      "containerElement": "document"
                    },
                    "time": 700
                  }
                ]
              },
              {
                "keywords": [
                  "country"
                ]
              }
            ],
            [
              "state",
              {
                "actions": [
                  {
                    "path": [
                      ".//input[contains(@aria-label, 'Employer State') and not(contains(@style, 'visibility: hidden'))]",
                      ".//input[contains(@id, 'stateProvinceCode')]"
                    ],
                    "method": "click",
                    "options": {
                      "waitForNetworkBeforeInteraction": true,
                      "waitForNetworkAfterInteraction": true
                    },
                    "time": 500
                  },
                  {
                    "path": [
                      ".//input[contains(@aria-label, 'Employer State') and contains(@id, 'filter')]",
                      ".//input[contains(@id, 'stateProvinceCode')]"
                    ],
                    "method": "setValue",
                    "options": {
                      "checkElementVisibility": true,
                      "waitForNetworkAfterInteraction": true,
                      "triggerBlurEvent": false,
                      "triggerChangeEvent": true,
                      "waitForNetworkBeforeInteraction": true
                    },
                    "time": 1000
                  },
                  {
                    "path": [
                      "//ul[@role='grid'][li[contains(@class, 'listview-item') and @role='row']]",
                      ".//div[contains(@id, 'stateProvinceCode') and contains(@id,'listbox-container')]"
                    ],
                    "method": "clickOption",
                    "options": {
                      "waitForNetworkBeforeInteraction": true
                    }
                  }
                ]
              },
              {
                "keywords": [
                  "state",
                  "country"
                ]
              }
            ],
            [
              "city",
              {
                "actions": [
                  {
                    "path": [
                      "//input[contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'employercity')]"
                    ],
                    "method": "click"
                  },
                  {
                    "path": [
                      "//input[contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'employercity')]"
                    ],
                    "method": "setValue",
                    "options": {
                      "triggerBlurEvent": false
                    }
                  },
                  {
                    "path": [
                      "//input[contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'employercity')]"
                    ],
                    "method": "click",
                    "options": {
                      "checkElementVisibility": true
                    }
                  },
                  {
                    "path": [
                      "//ul[@role='grid'][li]"
                    ],
                    "method": "clickOption",
                    "options": {
                      "containerElement": "document"
                    }
                  }
                ]
              },
              {
                "keywords": [
                  "city"
                ]
              }
            ],
            [
              "isCurrent",
              {
                "actions": [
                  {
                    "path": [
                      ".//span[contains(., 'Current') and not(contains(., 'Employment'))]/../span"
                    ],
                    "method": "clickCheckbox"
                  }
                ]
              },
              {
                "keywords": [
                  "current"
                ]
              }
            ],
            [
              "partTime",
              {
                "actions": [
                  {
                    "path": [
                      "//ul[@role='list' and contains(translate(@aria-label, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'part time')]"
                    ],
                    "method": "clickOption",
                    "defaultValue": "No"
                  }
                ]
              },
              {
                "keywords": [
                  "part time"
                ]
              }
            ],
            [
              "supervisor",
              [
                {
                  "actions": [
                    {
                      "path": [
                        "//input[contains(@name, 'supervisor') and not (@style='visibility: hidden;')]"
                      ],
                      "method": "setValueMultiple"
                    },
                    {
                      "path": [
                        "//input[contains(@aria-label, 'Supervisor') and not (@style='visibility: hidden;')]"
                      ],
                      "method": "click"
                    },
                    {
                      "path": [
                        "//ul[@role='grid'][li]"
                      ],
                      "method": "clickOption",
                      "values": {
                        "Available upon request": [
                          "Yes"
                        ],
                        "": [
                          "No"
                        ]
                      }
                    }
                  ]
                },
                {
                  "actions": [
                    {
                      "path": [
                        "//input[contains(@aria-label, 'OK to Contact Supervisor') and not (@style='visibility: hidden;')]"
                      ],
                      "method": "click",
                      "time": 500
                    },
                    {
                      "path": [
                        "//ul[@role='grid'][li]//span[contains(text(), 'No')]",
                        "//ul[@aria-label='OK to Contact Supervisor']//button[contains(normalize-space(.), 'No')]"
                      ],
                      "method": "click"
                    }
                  ]
                }
              ],
              {
                "keywords": [
                  "supervisor",
                  "manager"
                ]
              }
            ],
            [
              "nextBtn",
              {
                "actions": [
                  {
                    "path": [
                      ".//button[contains(@data-qa, 'addTileItemDialogButton')]",
                      ".//button[contains(@data-qa, 'addTimelineItemDialogButton')]",
                      ".//button[contains(@data-qa, 'profileItemInlineSaveButton')]",
                      "//button[not(@disabled) and contains(@class, 'save-btn') and .//span[contains(text(), 'Add Experience') and not(contains(text(), 'Government'))]]"
                    ],
                    "method": "click",
                    "options": {
                      "waitForNetworkAfterInteraction": true
                    },
                    "time": 1000
                  }
                ]
              },
              {
                "keywords": [
                  "add",
                  "done"
                ]
              }
            ],
            [
              "checkErrors",
              {
                "actions": [
                  {
                    "path": [
                      ".//p[contains(@class, 'validation') and @role='alert']"
                    ],
                    "method": "checkForErrorsInModal",
                    "options": {
                      "removeButton": [
                        ".//button[contains(@data-bind, 'removeProfileItem')]",
                        ".//button[contains(@class, 'cancel-btn')]",
                        ".//button[contains(@data-bind, 'remove.bind')]"
                      ],
                      "waitForNetworkAfterInteraction": true
                    },
                    "time": 5000
                  }
                ]
              },
              {
                "keywords": [
                  "cancel",
                  "remove"
                ]
              }
            ]
          ],
          "options": {
            "clickOutsideAtEnd": true,
            "checkElementVisibility": true,
            "containerInModal": true,
            "afterAddButtonAsyncDelay": 1000,
            "getRelevantEntities": true
          }
        },
        {
          "keywords": [
            "experience",
            "work and education history"
          ]
        }
      ],
      [
        "certification",
        {
          "addButtonPath": [
            ".//div[contains(@aria-label, 'Certificates')]/button"
          ],
          "options": {
            "checkElementVisibility": true,
            "containerInModal": true
          },
          "containerPath": [
            ".//oj-dialog[contains(@aria-label,'Add License')]"
          ],
          "confirmAddedPath": [
            ".//button[contains(@data-qa, 'addTileItemDialogButton')]"
          ],
          "entryContainer": {
            "title": [
              "//div[contains(@aria-label, 'certificates')]//button//div[contains(@class, 'summary-title')]"
            ],
            "subtitle": []
          },
          "time": 1500,
          "entities": [
            [
              "name",
              {
                "actions": [
                  {
                    "path": [
                      ".//input[contains(@aria-label,'Certificate') and contains(@id, 'filter')]",
                      ".//input[contains(@name,'certificationName')]"
                    ],
                    "method": "click",
                    "options": {
                      "waitForNetworkAfterInteraction": true
                    }
                  },
                  {
                    "path": [
                      ".//input[contains(@aria-label,'Certificate') and contains(@id, 'filter')]/ancestor::oj-input-text[1]//input",
                      ".//input[contains(@aria-label,'Certificate')]",
                      ".//input[contains(@name,'certificationName')]"
                    ],
                    "method": "setValue",
                    "options": {
                      "triggerBlurEvent": false,
                      "waitForNetworkAfterInteraction": true,
                      "waitForNetworkBeforeInteraction": true
                    },
                    "time": 500
                  },
                  {
                    "path": [
                      ".//input[contains(@aria-label,'Certificate') and contains(@id, 'filter')]",
                      ".//input[contains(@name,'certificationName')]"
                    ],
                    "method": "click",
                    "options": {
                      "waitForNetworkAfterInteraction": true
                    },
                    "time": 1000
                  },
                  {
                    "path": [
                      "//ul[@role='grid'][li[contains(@class, 'listview-item')]]"
                    ],
                    "method": "clickOption",
                    "options": {
                      "containerElement": "document",
                      "waitForNetworkBeforeInteraction": true,
                      "removeButton": [
                        ".//button[contains(@data-bind, 'removeProfileItem')]"
                      ]
                    }
                  }
                ]
              },
              {
                "keywords": [
                  "certificate",
                  "certification"
                ]
              }
            ],
            [
              "issueDateMonthText",
              {
                "actions": [
                  {
                    "path": [
                      ".//oj-select-single[contains(translate(@aria-label, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'issue date month')]//input[contains(@class,'oj-searchselect-input oj-text-field-input')]"
                    ],
                    "method": "click",
                    "options": {
                      "waitForNetworkAfterInteraction": true
                    }
                  },
                  {
                    "path": [
                      "//ul[@role='grid' and .//text()[contains(., 'January') or contains(., 'February') or contains(., 'March') or contains(., 'April') or contains(., 'May') or contains(., 'June') or contains(., 'July') or contains(., 'August') or contains(., 'September') or contains(., 'October') or contains(., 'November') or contains(., 'December')]]"
                    ],
                    "method": "clickOption",
                    "values": {
                      "January": [
                        "Jan",
                        "January",
                        "01"
                      ],
                      "February": [
                        "Feb",
                        "February",
                        "02"
                      ],
                      "March": [
                        "Mar",
                        "March",
                        "03"
                      ],
                      "April": [
                        "Apr",
                        "April",
                        "04"
                      ],
                      "May": [
                        "May",
                        "05"
                      ],
                      "June": [
                        "Jun",
                        "June",
                        "06"
                      ],
                      "July": [
                        "Jul",
                        "July",
                        "07"
                      ],
                      "August": [
                        "Aug",
                        "August",
                        "08"
                      ],
                      "September": [
                        "Sep",
                        "September",
                        "09"
                      ],
                      "October": [
                        "Oct",
                        "October",
                        "10"
                      ],
                      "November": [
                        "Nov",
                        "November",
                        "11"
                      ],
                      "December": [
                        "Dec",
                        "December",
                        "12"
                      ]
                    },
                    "options": {
                      "containerElement": "document",
                      "ariaKey": "ariaOwns",
                      "waitForNetworkBeforeInteraction": true
                    },
                    "attributes": {
                      "ariaOwns": "aria-owns",
                      "ariaControls": "aria-controls"
                    }
                  }
                ]
              },
              {
                "keywords": [
                  "issue date"
                ]
              }
            ],
            [
              "issueDateDay",
              {
                "actions": [
                  {
                    "path": [
                      ".//oj-select-single[contains(translate(@aria-label, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'issue date day')]//input[contains(@class,'oj-searchselect-input oj-text-field-input')]"
                    ],
                    "method": "click",
                    "options": {
                      "waitForNetworkAfterInteraction": true
                    }
                  },
                  {
                    "path": [
                      ".//div[@id='__ariaOwns__']"
                    ],
                    "ariaPath": [
                      ".//oj-select-single[contains(translate(@aria-label, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'issue date day')]//input[contains(@class,'oj-searchselect-input oj-text-field-input')]"
                    ],
                    "method": "clickOption",
                    "options": {
                      "containerElement": "document",
                      "ariaKey": "ariaOwns",
                      "waitForNetworkBeforeInteraction": true
                    },
                    "attributes": {
                      "ariaOwns": "aria-owns",
                      "ariaControls": "aria-controls"
                    }
                  }
                ]
              },
              {
                "keywords": [
                  "issue date"
                ]
              }
            ],
            [
              "issueDateYear",
              {
                "actions": [
                  {
                    "path": [
                      ".//input[contains(translate(@aria-label, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'issue date year')]"
                    ],
                    "method": "setValue",
                    "options": {
                      "triggerKeyDownEvent": true,
                      "triggerKeyUpEvent": true,
                      "triggerInputEvent": true,
                      "triggerBlurEvent": true,
                      "triggerChangeEvent": true,
                      "triggerFocusEvent": true,
                      "triggerFocusInEvent": true
                    }
                  }
                ]
              },
              {
                "keywords": [
                  "issue date"
                ]
              }
            ],
            [
              "nextBtn",
              {
                "actions": [
                  {
                    "path": [
                      ".//button[contains(@data-qa, 'addTileItemDialogButton')]"
                    ],
                    "method": "click",
                    "time": 1000
                  }
                ]
              },
              {
                "keywords": [
                  "add",
                  "done"
                ]
              }
            ],
            [
              "checkErrors",
              {
                "actions": [
                  {
                    "path": [
                      ".//p[contains(@class, 'validation') and @role='alert']"
                    ],
                    "method": "checkForErrorsInModal",
                    "options": {
                      "removeButton": [
                        ".//button[contains(@data-bind, 'removeProfileItem')]"
                      ],
                      "waitForNetworkAfterInteraction": true
                    }
                  }
                ]
              },
              {
                "keywords": [
                  "cancel",
                  "remove"
                ]
              }
            ]
          ]
        },
        {
          "keywords": [
            "certification",
            "license",
            "licenses and certificates",
            "certificate"
          ]
        }
      ],
      [
        "resume",
        {
          "actions": [
            {
              "path": [
                ".//input[@type='file' and contains(@title, 'Upload Resume')]",
                ".//label[text()='Upload Resume']/preceding-sibling::input",
                ".//label[span[text()='Upload Resume']]/preceding-sibling::input",
                ".//label[span[text()='UPLOAD CV / RESUME']]/preceding-sibling::input",
                "//label[span[contains(text(), 'Resume')]]/preceding-sibling::input[@type='file' and contains(@id, 'attachment')]"
              ],
              "method": "uploadResume",
              "options": {
                "waitForNetworkBeforeInteraction": true
              }
            }
          ]
        },
        {
          "keywords": [
            "resume",
            "documents"
          ]
        }
      ],
      [
        "education",
        {
          "addButtonPath": [
            ".//div[contains(@aria-label, 'Education')]/button",
            "//button[.//span[contains(text(), 'Education')]]"
          ],
          "options": {
            "checkElementVisibility": true,
            "clickOutsideAtEnd": true,
            "containerInModal": true,
            "waitForNetworkAfterInteraction": true,
            "waitForNetworkBeforeInteraction": true,
            "getRelevantEntities": true
          },
          "time": 1500,
          "containerPath": [
            ".//oj-dialog[contains(@aria-label,'Add Education')]//div[contains(@class, 'dialog-body') and contains(@class, 'main') and not(contains(@class, 'wrapper'))]",
            "//timeline-form-inline[.//timeline-form-builder[.//*[contains(text(), 'Degree') or contains(text(), 'School') or contains(text(), 'Education Level')]]]",
            "//div[contains(@class, 'profile-items')][.//*[contains(text(), 'Degree') or contains(text(), 'School') or contains(text(), 'Area of Study') or contains(text(), 'Education Level')]]"
          ],
          "confirmAddedPath": [
            ".//button[contains(@data-qa, 'addTileItemDialogButton')]"
          ],
          "entryContainer": {
            "title": [
              "//div[contains(@aria-label, 'education')]//button//div[contains(@class, 'summary-title')]",
              "//beautiful-timeline-item[contains(@params, 'education')]//span[contains(@class, 'item__title')]"
            ],
            "subtitle": [
              "//div[contains(@aria-label, 'education')]//button//div[contains(@class, 'summary-subtitle')]",
              "//beautiful-timeline-item[contains(@params, 'education')]//span[contains(@class, 'item__subtitle')]"
            ]
          },
          "entities": [
            [
              "name",
              {
                "actions": [
                  {
                    "path": [
                      ".//input[contains(@aria-label, 'School') and contains(@id, 'filter') or contains(@aria-label, 'University') or contains(@aria-label, 'Educational Institution') and contains(@id, 'filter')] |//textarea[contains(@id, 'educationalEstablishment')]",
                      ".//input[contains(@aria-label, 'School') and contains(@id, 'filter')]",
                      ".//input[contains(@aria-label, 'School') and contains(@placeholder, 'Start typing to see suggestions')]",
                      ".//input[contains(@aria-label, 'School') and @role='combobox' and @placeholder=' ']",
                      ".//input[contains(@name, 'educationalEstablishment')]"
                    ],
                    "method": "click",
                    "options": {
                      "preventClickIfEmpty": true,
                      "waitForNetworkAfterInteraction": true
                    },
                    "time": 1250
                  },
                  {
                    "path": [
                      ".//input[contains(@aria-label, 'School') and contains(@id, 'filter') or contains(@aria-label, 'University') or contains(@aria-label, 'Educational Institution') and contains(@id, 'filter')] |//textarea[contains(@id, 'educationalEstablishment')]",
                      ".//input[contains(@aria-label, 'School') and contains(@placeholder, 'Start typing to see suggestions')]",
                      ".//input[contains(@aria-label, 'School') and @role='combobox' and @placeholder=' ']",
                      ".//input[contains(@name, 'educationalEstablishment')]"
                    ],
                    "method": "setValue",
                    "options": {
                      "triggerBlurEvent": false,
                      "checkAcronym": true,
                      "separatorCharacter": ", ",
                      "waitForNetworkAfterInteraction": true,
                      "waitForNetworkBeforeInteraction": true,
                      "trackQuestion": true,
                      "resetValue": true
                    },
                    "time": 1000
                  },
                  {
                    "path": [
                      ".//input[contains(@aria-label, 'School') and contains(@placeholder, 'Start typing to see suggestions')]"
                    ],
                    "method": "pressEnterKey",
                    "options": {
                      "waitForNetworkAfterInteraction": true,
                      "waitForNetworkBeforeInteraction": true
                    },
                    "time": 250
                  },
                  {
                    "path": [
                      "//ul[@role='grid'][li]",
                      "//ul[@role='listbox' and not(contains(@class, 'loading')) and li]",
                      "//div[contains(@id, 'educationalEstablishment') and contains(@id,'listbox-container')]"
                    ],
                    "method": "clickOption",
                    "options": {
                      "containerElement": "document",
                      "checkAcronym": true,
                      "separatorCharacter": ", ",
                      "dropdownPersistent": true,
                      "waitForNetworkBeforeInteraction": true,
                      "autocomplete": true,
                      "fallbackOptionsArray": [
                        "Other",
                        "Other US Institution",
                        "Other/Autre/Otros/Andere/Altri/Ander/Outro/Inny"
                      ]
                    }
                  }
                ]
              },
              {
                "keywords": [
                  "school",
                  "university",
                  "educational institution",
                  "institution"
                ]
              }
            ],
            [
              "degree",
              [
                {
                  "actions": [
                    {
                      "path": [
                        "//input[@name='degreeName']"
                      ],
                      "method": "setValue"
                    }
                  ]
                },
                {
                  "actions": [
                    {
                      "path": [
                        "//div[contains(@class, 'app-dialog__content')]//input[((@aria-label = 'Education Level' and contains(@class, 'searchselect') and //input[@aria-label = 'Degree' and contains(@class, 'searchselect')]) or (@aria-label = 'Degree' and contains(@class, 'searchselect') and not(//input[@aria-label = 'Education Level' and contains(@class, 'searchselect')])))]",
                        "//div[not(.//input[@aria-label='Education Level'])]//input[@aria-label='Degree']",
                        "//div[not(.//input[@id='major'])]//input[@aria-label='Education Level']",
                        "//input[@aria-label='Degree Type' and contains(@id, 'filter')]",
                        "//input[not(@type='radio') and @id=(//label[contains(normalize-space(.), 'Degree')]/@for)]",
                        "//div[@class='input-row input-row--has-picker' and .//label[normalize-space(.)='Degree'] and .//ul[@role='list' and @aria-label='Degree']]",
                        "//div[@class='input-row input-row--has-picker' and .//label[normalize-space(.)='Education Level'] and .//ul[@role='list' and @aria-label='Education Level']]",
                        "//div[contains(@class, 'input-row') and contains(@class, 'input-row--has-picker') and .//label[normalize-space(.)='Education Level']]//input"
                      ],
                      "method": "click",
                      "options": {
                        "preventClickIfEmpty": true,
                        "waitForNetworkBeforeInteraction": true,
                        "waitForNetworkAfterInteraction": true,
                        "trackQuestion": true
                      },
                      "time": 250
                    },
                    {
                      "path": [
                        "//ul[@role='grid'][li[contains(@class, 'listview-item')]]",
                        "//div[contains(@id, 'contentItemId') and @role='grid']",
                        "//ul[@role='list' and translate(@aria-label,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz')='degree']",
                        "//div[@role='grid' and contains(translate(@aria-label, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'degree')]"
                      ],
                      "method": "clickOption",
                      "options": {
                        "waitForNetworkBeforeInteraction": true,
                        "fallbackOptionsArray": [
                          "None",
                          "Other",
                          "Other Program"
                        ],
                        "preserveSpecialChars": true
                      },
                      "values": {
                        "bachelor's": [
                          "Bachelor's Degree",
                          "Bachelors",
                          "Bachelor's Degree (16 years)"
                        ],
                        "master's": [
                          "Master's Degree",
                          "Master of Science",
                          "Masters"
                        ],
                        "associate's": [
                          "Associate's Degree"
                        ]
                      }
                    }
                  ]
                }
              ],
              {
                "keywords": [
                  "degree",
                  "education level"
                ]
              }
            ],
            [
              "degreeDisplay",
              [
                {
                  "actions": [
                    {
                      "path": [
                        "//input[@name='educationLevel']"
                      ],
                      "method": "click",
                      "options": {
                        "waitForNetworkBeforeInteraction": true,
                        "waitForNetworkAfterInteraction": true,
                        "trackQuestion": true
                      }
                    },
                    {
                      "path": [
                        "//div[@role='grid' and contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'educationlevel')]",
                        "//ul[@role='list' and translate(@aria-label,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz')='education level']"
                      ],
                      "method": "clickOption",
                      "options": {
                        "waitForNetworkBeforeInteraction": true,
                        "fallbackOptionsArray": [
                          "None",
                          "Other"
                        ],
                        "forceOptionSearch": true
                      },
                      "values": {
                        "bachelor's": [
                          "Bachelor's Degree",
                          "Bachelors",
                          "Bachelor's Degree (16 years)"
                        ],
                        "master's": [
                          "Master's Degree",
                          "Master of Science",
                          "Masters"
                        ],
                        "associate's": [
                          "Associate's Degree"
                        ]
                      }
                    }
                  ]
                }
              ],
              {
                "keywords": [
                  "education level"
                ]
              }
            ],
            [
              "major",
              {
                "actions": [
                  {
                    "path": [
                      "//div[contains(@class, 'app-dialog__content')]//input[(contains(@aria-label, 'Education Level') and not(//input[starts-with(@name, 'major')]) or starts-with(@name, 'major')) or (contains(@aria-label, 'Degree') and contains(@id, 'filter') and not(//input[starts-with(@name, 'major')]) and not(//input[contains(@aria-label, 'Major')]))]",
                      "//input[@aria-label='Major' and contains(@id, 'filter')]",
                      "//input[@name='major']"
                    ],
                    "method": "click",
                    "options": {
                      "waitForNetworkAfterInteraction": true,
                      "checkForValue": true
                    },
                    "time": 1250
                  },
                  {
                    "path": [
                      "//div[contains(@class, 'app-dialog__content')]//input[(contains(@aria-label, 'Education Level') and not(//input[starts-with(@name, 'major')]) or starts-with(@name, 'major')) or (contains(@aria-label, 'Degree') and contains(@id, 'filter') and not(//input[starts-with(@name, 'major')]) and not(//input[contains(@aria-label, 'Major')]))]",
                      "//input[@aria-label='Major' and contains(@id, 'filter')]",
                      "//input[@name='major']"
                    ],
                    "method": "setValue",
                    "options": {
                      "triggerBlurEvent": false,
                      "resetValue": true,
                      "waitForNetworkBeforeInteraction": true,
                      "waitForNetworkAfterInteraction": true,
                      "trackQuestion": true,
                      "checkForValue": true
                    },
                    "time": 1250
                  },
                  {
                    "path": [
                      "//div[contains(@id, 'major')]//div[@role='grid']",
                      "//ul[@role='grid'][li]"
                    ],
                    "method": "clickOption",
                    "options": {
                      "waitForNetworkBeforeInteraction": true,
                      "autocomplete": true,
                      "optionMapper": true
                    }
                  }
                ]
              },
              {
                "keywords": [
                  "major",
                  "field of study",
                  "education level"
                ]
              }
            ],
            [
              "startDateMonthText",
              {
                "actions": [
                  {
                    "path": [
                      ".//label[contains(., 'Start Date')]/../following-sibling::*[1]//input[contains(@class,'oj-searchselect-input oj-text-field-input')]",
                      "//div[contains(@class, 'datepicker-row') and .//span[normalize-space() = 'Start Date']]//input[contains(@id,'month-startDate')]"
                    ],
                    "method": "click",
                    "options": {
                      "preventClickIfEmpty": true,
                      "waitForNetworkAfterInteraction": true,
                      "waitForNetworkBeforeInteraction": true
                    },
                    "time": 500
                  },
                  {
                    "path": [
                      "//ul[@role='grid' and .//text()[contains(., 'January')]]",
                      ".//div[contains(@id,'month-startDate') and contains(@id,'listbox-container')]"
                    ],
                    "method": "clickOption",
                    "values": {
                      "January": [
                        "Jan",
                        "January",
                        "01"
                      ],
                      "February": [
                        "Feb",
                        "February",
                        "02"
                      ],
                      "March": [
                        "Mar",
                        "March",
                        "03"
                      ],
                      "April": [
                        "Apr",
                        "April",
                        "04"
                      ],
                      "May": [
                        "May",
                        "05"
                      ],
                      "June": [
                        "Jun",
                        "June",
                        "06"
                      ],
                      "July": [
                        "Jul",
                        "July",
                        "07"
                      ],
                      "August": [
                        "Aug",
                        "August",
                        "08"
                      ],
                      "September": [
                        "Sep",
                        "September",
                        "09"
                      ],
                      "October": [
                        "Oct",
                        "October",
                        "10"
                      ],
                      "November": [
                        "Nov",
                        "November",
                        "11"
                      ],
                      "December": [
                        "Dec",
                        "December",
                        "12"
                      ]
                    },
                    "options": {
                      "containerElement": "document"
                    }
                  }
                ]
              },
              {
                "keywords": [
                  "start date",
                  "month"
                ]
              }
            ],
            [
              "startDateYear",
              {
                "actions": [
                  {
                    "path": [
                      "//input[@aria-label='Start Date Year']",
                      "//div[contains(@class, 'datepicker-row') and .//span[normalize-space() = 'Start Date']]//input[contains(@id,'year-startDate')]"
                    ],
                    "method": "click",
                    "options": {
                      "preventClickIfEmpty": true,
                      "waitForNetworkAfterInteraction": true
                    },
                    "time": 500
                  },
                  {
                    "path": [
                      "//input[@aria-label='Start Date Year']",
                      "//div[contains(@class, 'datepicker-row') and .//span[normalize-space() = 'Start Date']]//input[contains(@id,'year-startDate')]"
                    ],
                    "method": "setValue",
                    "options": {
                      "triggerKeyDownEvent": true,
                      "triggerKeyUpEvent": true,
                      "triggerInputEvent": true,
                      "triggerBlurEvent": false,
                      "triggerChangeEvent": true,
                      "triggerFocusEvent": true,
                      "triggerFocusInEvent": true
                    }
                  },
                  {
                    "path": [
                      ".//div[contains(@id,'year-startDate')]//div[@role='grid']"
                    ],
                    "method": "clickOption",
                    "time": 500
                  },
                  {
                    "path": [
                      "//input[@aria-label='Start Date Year']",
                      "//div[contains(@class, 'datepicker-row') and .//span[normalize-space() = 'Start Date']]//input[contains(@id,'year-startDate')]"
                    ],
                    "method": "click",
                    "options": {
                      "preventClickIfEmpty": true,
                      "waitForNetworkAfterInteraction": true
                    },
                    "time": 500
                  }
                ]
              },
              {
                "keywords": [
                  "start date",
                  "year"
                ]
              }
            ],
            [
              "endDateMonthText",
              {
                "actions": [
                  {
                    "path": [
                      ".//label[contains(., 'End Date')]/../following-sibling::*[1]//input[contains(@class,'oj-searchselect-input oj-text-field-input')]",
                      "//input[contains(@id,'month-endDate')]"
                    ],
                    "method": "click",
                    "options": {
                      "waitForNetworkAfterInteraction": true,
                      "waitForNetworkBeforeInteraction": true,
                      "preventClickIfEmpty": true
                    },
                    "time": 500
                  },
                  {
                    "path": [
                      "//ul[@role='grid' and .//li[contains(@class, 'listview-item')] and .//text()[contains(., 'January')]]",
                      ".//div[contains(@id,'month-endDate') and contains(@id,'listbox-container')]"
                    ],
                    "method": "clickOption",
                    "values": {
                      "January": [
                        "Jan",
                        "January",
                        "01"
                      ],
                      "February": [
                        "Feb",
                        "February",
                        "02"
                      ],
                      "March": [
                        "Mar",
                        "March",
                        "03"
                      ],
                      "April": [
                        "Apr",
                        "April",
                        "04"
                      ],
                      "May": [
                        "May",
                        "05"
                      ],
                      "June": [
                        "Jun",
                        "June",
                        "06"
                      ],
                      "July": [
                        "Jul",
                        "July",
                        "07"
                      ],
                      "August": [
                        "Aug",
                        "August",
                        "08"
                      ],
                      "September": [
                        "Sep",
                        "September",
                        "09"
                      ],
                      "October": [
                        "Oct",
                        "October",
                        "10"
                      ],
                      "November": [
                        "Nov",
                        "November",
                        "11"
                      ],
                      "December": [
                        "Dec",
                        "December",
                        "12"
                      ]
                    },
                    "options": {
                      "containerElement": "document",
                      "waitForNetworkBeforeInteraction": true
                    }
                  }
                ]
              },
              {
                "keywords": [
                  "end date",
                  "month",
                  "date acquired"
                ]
              }
            ],
            [
              "endDateYear",
              {
                "actions": [
                  {
                    "path": [
                      "//input[@aria-label='End Date Year']",
                      "//input[contains(@id,'year-endDate')]"
                    ],
                    "method": "click",
                    "options": {
                      "preventClickIfEmpty": true
                    },
                    "time": 500
                  },
                  {
                    "path": [
                      "//input[@aria-label='End Date Year']",
                      ".//input[contains(@id,'year-endDate')]"
                    ],
                    "method": "setValue",
                    "options": {
                      "triggerKeyDownEvent": true,
                      "triggerKeyUpEvent": true,
                      "triggerInputEvent": true,
                      "triggerBlurEvent": false,
                      "triggerChangeEvent": true,
                      "triggerFocusEvent": true,
                      "triggerFocusInEvent": true
                    }
                  },
                  {
                    "path": [
                      ".//div[contains(@id,'year-endDate') and @role='grid']"
                    ],
                    "method": "clickOption",
                    "time": 500
                  },
                  {
                    "path": [
                      "//input[@aria-label='End Date Year']"
                    ],
                    "method": "click",
                    "options": {
                      "preventClickIfEmpty": true
                    },
                    "time": 500
                  }
                ]
              },
              {
                "keywords": [
                  "end date",
                  "year",
                  "date acquired"
                ]
              }
            ],
            [
              "isGraduated",
              {
                "actions": [
                  {
                    "path": [
                      ".//span[contains(., 'Graduated')]/../span"
                    ],
                    "method": "clickCheckbox"
                  }
                ]
              },
              {
                "keywords": [
                  "graduated",
                  "graduation"
                ]
              }
            ],
            [
              "country",
              {
                "actions": [
                  {
                    "path": [
                      ".//input[contains(@aria-label, 'Country') and contains(@class,'searchselect')]",
                      "//input[@name='countryCode']"
                    ],
                    "method": "click",
                    "options": {
                      "preventClickIfEmpty": true,
                      "waitForNetworkAfterInteraction": true
                    }
                  },
                  {
                    "path": [
                      ".//input[contains(@aria-label, 'Country') and contains(@class,'searchselect')]/ancestor::div[2]/following-sibling::oj-input-text//input",
                      "//input[@name='countryCode']"
                    ],
                    "method": "setValue",
                    "options": {
                      "triggerBlurEvent": false,
                      "waitForNetworkAfterInteraction": true,
                      "waitForNetworkBeforeInteraction": true
                    }
                  },
                  {
                    "path": [
                      "//ul[@role='grid' and .//text()[contains(., 'United States')]]",
                      "//div[contains(@id, 'countryCode')]//div[@role='grid']"
                    ],
                    "method": "clickOption",
                    "options": {
                      "waitForNetworkBeforeInteraction": true,
                      "containerElement": "document"
                    },
                    "time": 750
                  }
                ]
              },
              {
                "keywords": [
                  "location",
                  "country"
                ]
              }
            ],
            [
              "state",
              {
                "actions": [
                  {
                    "path": [
                      ".//input[contains(@aria-label, 'State') and contains(@class,'searchselect')]",
                      "//input[@name='stateProvinceCode']"
                    ],
                    "method": "click",
                    "options": {
                      "waitForNetworkBeforeInteraction": true,
                      "preventClickIfEmpty": true
                    }
                  },
                  {
                    "path": [
                      ".//input[contains(@aria-label, 'State') and contains(@id,'filter')]",
                      "//input[@name='stateProvinceCode']"
                    ],
                    "method": "setValue",
                    "options": {
                      "triggerBlurEvent": false
                    }
                  },
                  {
                    "path": [
                      "//ul[@role='grid'][li[contains(@class, 'listview-item') and @role='row']]",
                      ".//div[contains(@id, 'stateProvinceCode') and contains(@id,'listbox-container')]"
                    ],
                    "method": "clickOption",
                    "options": {
                      "waitForNetworkBeforeInteraction": true,
                      "containerElement": "document"
                    }
                  }
                ]
              },
              {
                "keywords": [
                  "state",
                  "country"
                ]
              }
            ],
            [
              "isCurrent",
              {
                "actions": [
                  {
                    "path": [
                      ".//input[contains(@aria-label, 'Status') and contains(@class,'searchselect')]"
                    ],
                    "method": "click"
                  },
                  {
                    "path": [
                      ".//div[@id='__ariaOwns__']"
                    ],
                    "ariaPath": [
                      ".//input[contains(@aria-label, 'Status') and contains(@class,'searchselect')]"
                    ],
                    "method": "clickOption",
                    "values": {
                      "true": "In Progress",
                      "false": "Graduated/Completed"
                    },
                    "options": {
                      "containerElement": "document",
                      "ariaKey": "ariaOwns"
                    },
                    "attributes": {
                      "ariaOwns": "aria-owns",
                      "ariaControls": "aria-controls"
                    }
                  }
                ]
              },
              {
                "keywords": [
                  "status",
                  "graduated"
                ]
              }
            ],
            [
              "city",
              {
                "actions": [
                  {
                    "path": [
                      ".//input[starts-with(@name, 'city')]"
                    ],
                    "method": "setValue",
                    "fallbackValue": "NA"
                  }
                ]
              },
              {
                "keywords": [
                  "city",
                  "country"
                ]
              }
            ],
            [
              "gpa",
              [
                ".//input[starts-with(@name, 'gpa')]"
              ],
              {
                "keywords": [
                  "gpa"
                ]
              }
            ],
            [
              "degreeDisplay",
              {
                "actions": [
                  {
                    "path": [
                      "//input[contains(@aria-label, 'Highest Education Level') and contains(@id, 'filter')]"
                    ],
                    "method": "click",
                    "options": {
                      "waitForNetworkBeforeInteraction": true,
                      "waitForNetworkAfterInteraction": true,
                      "trackQuestion": true
                    },
                    "time": 1000
                  },
                  {
                    "path": [
                      "//input[contains(@aria-label, 'Highest Education Level') and contains(@id, 'filter')]"
                    ],
                    "method": "setValue",
                    "options": {
                      "waitForNetworkBeforeInteraction": true,
                      "waitForNetworkAfterInteraction": true
                    },
                    "time": 1500
                  },
                  {
                    "path": [
                      "//ul[@role='grid'][li]"
                    ],
                    "method": "clickOption",
                    "values": {
                      "bachelor's": [
                        "Bachelor",
                        "Bachelor's Degree",
                        "Bachelor's Level Degree",
                        "BS"
                      ],
                      "master's": [
                        "Master",
                        "Master's Degree",
                        "Master's Level Degree",
                        "MS"
                      ],
                      "associate": [
                        "2 - Year College Degree",
                        "Associate",
                        "Some Graduate School"
                      ],
                      "highschool": [
                        "High School",
                        "Highschool",
                        "Highschool Diploma",
                        "HS Graduate or Equivalent"
                      ],
                      "other": [
                        "Technical, Other"
                      ]
                    },
                    "options": {
                      "waitForNetworkBeforeInteraction": true
                    }
                  }
                ]
              },
              {
                "keywords": [
                  "highest education level"
                ]
              }
            ],
            [
              "nextBtn",
              {
                "actions": [
                  {
                    "path": [
                      ".//button[contains(@data-qa, 'addTileItemDialogButton') or contains(@data-qa, 'addTimelineItemDialogButton')]",
                      "//button[contains(@class, 'save-btn') and .//span[normalize-space(text())='Add Education']]"
                    ],
                    "method": "click",
                    "options": {
                      "waitForNetworkAfterInteraction": true
                    },
                    "time": 1000
                  }
                ]
              },
              {
                "keywords": [
                  "add",
                  "done"
                ]
              }
            ],
            [
              "checkErrors",
              {
                "actions": [
                  {
                    "path": [
                      ".//p[contains(@class, 'validation') and @role='alert']"
                    ],
                    "method": "checkForErrorsInModal",
                    "options": {
                      "removeButton": [
                        ".//button[contains(@data-bind, 'removeProfileItem')]",
                        ".//button[contains(@class, 'cancel-btn')]",
                        ".//button[contains(@data-bind, 'remove.bind')]"
                      ],
                      "waitForNetworkAfterInteraction": true
                    }
                  }
                ]
              },
              {
                "keywords": [
                  "cancel",
                  "remove"
                ]
              }
            ]
          ]
        },
        {
          "keywords": [
            "education",
            "work and education history"
          ]
        }
      ],
      [
        "skill",
        {
          "addButtonPath": [
            ".//div[contains(@aria-label, 'Skill')]/button[contains(text(), 'Skill')]",
            "//button//span[contains(text(), 'Skill')]/.."
          ],
          "options": {
            "checkElementVisibility": true,
            "clickOutsideAtEnd": true,
            "containerInModal": true,
            "waitForNetworkAfterInteraction": true,
            "waitForNetworkBeforeInteraction": true
          },
          "containerPath": [
            ".//oj-dialog[contains(@aria-label,'Add Skill')]",
            "//div[contains(@class, 'skill')][.//*[contains(text(), 'Skill')]]"
          ],
          "confirmAddedPath": [
            ".//button[contains(@data-qa, 'addTileItemDialogButton')]"
          ],
          "entryContainer": {
            "title": [
              "//div[contains(@aria-label, 'skill')]//button//div[contains(@class, 'summary-title')]"
            ],
            "subtitle": [
              "//div[contains(@aria-label, 'skill')]//button//div[contains(@class, 'summary-subtitle')]"
            ]
          },
          "entities": [
            [
              "name",
              {
                "actions": [
                  {
                    "path": [
                      ".//input[contains(@name, 'skills')]"
                    ],
                    "method": "setValue",
                    "options": {
                      "resetValue": true
                    }
                  }
                ]
              }
            ],
            [
              "nextBtn",
              {
                "actions": [
                  {
                    "path": [
                      ".//button[contains(@data-qa, 'addTileItemDialogButton') or contains(@data-qa, 'addTimelineItemDialogButton')]",
                      "//button[contains(@class, 'save-btn') and .//span[normalize-space(text())='Add Skill']]"
                    ],
                    "method": "click",
                    "options": {
                      "waitForNetworkAfterInteraction": true
                    },
                    "time": 1000
                  }
                ]
              }
            ]
          ]
        },
        {
          "keywords": [
            "skill",
            "abilities"
          ]
        }
      ],
      [
        "languages",
        {
          "addButtonPath": [
            ".//div[contains(@aria-label, 'Languages')]/button",
            ".//button[span[contains(text(), 'Add Language')]]"
          ],
          "containerPath": [
            ".//oj-dialog[contains(@aria-label,'Add Language')]",
            "//div[contains(@class, 'profile-item-container') and .//button[contains(@aria-label, 'Language')]]"
          ],
          "confirmAddedPath": [
            ".//button[contains(@data-qa, 'addTileItemDialogButton')]"
          ],
          "entryContainer": {
            "title": [
              "//div[contains(@aria-label, 'languages')]//button//div[contains(@class, 'summary-title')]"
            ],
            "subtitle": [
              "//div[contains(@aria-label, 'languages')]//button//div[contains(@class, 'summary-subtitle')]"
            ]
          },
          "options": {
            "clickOutsideAtEnd": true,
            "checkElementVisibility": true,
            "containerInModal": true,
            "getRelevantEntities": true
          },
          "time": 1500,
          "entities": [
            [
              "language",
              {
                "actions": [
                  {
                    "path": [
                      ".//input[contains(@aria-label, 'Language') and contains(@id, 'filter')]",
                      "//div[contains(@class, 'input-field-container')][.//button[contains(@aria-label, 'Language') or contains(@title, 'Language')]]//input"
                    ],
                    "method": "click",
                    "options": {
                      "waitForNetworkAfterInteraction": true
                    },
                    "time": 500
                  },
                  {
                    "path": [
                      ".//input[contains(@aria-label, 'Language') and contains(@id, 'filter')]",
                      "//div[contains(@class, 'input-field-container')][.//button[contains(@aria-label, 'Language') or contains(@title, 'Language')]]//input"
                    ],
                    "method": "setValue",
                    "options": {
                      "triggerBlurEvent": false,
                      "waitForNetworkAfterInteraction": true,
                      "waitForNetworkBeforeInteraction": true
                    },
                    "time": 1250
                  },
                  {
                    "path": [
                      "//ul[@role='grid'][li]",
                      "//div[contains(@class, 'input-field-container')][.//button[contains(@aria-label, 'Language') or contains(@title, 'Language')]]//div[contains(@class, 'options')]"
                    ],
                    "method": "clickOption",
                    "options": {
                      "containerElement": "document",
                      "waitForNetworkBeforeInteraction": true,
                      "caseSentiveOption": true
                    }
                  },
                  {
                    "path": [
                      ".//input[contains(@aria-label, 'Language') and contains(@id, 'filter')]"
                    ],
                    "method": "pressEnterKey",
                    "options": {
                      "triggerBlurEvent": false,
                      "waitForNetworkAfterInteraction": true,
                      "waitForNetworkBeforeInteraction": true
                    }
                  }
                ]
              },
              {
                "keywords": [
                  "language"
                ]
              }
            ],
            [
              "speaking",
              {
                "actions": [
                  {
                    "path": [
                      ".//input[contains(@aria-label, 'Speaking') and contains(@id, 'filter')]"
                    ],
                    "method": "click",
                    "options": {
                      "waitForNetworkAfterInteraction": true,
                      "trackQuestion": true
                    },
                    "time": 500
                  },
                  {
                    "path": [
                      "//ul[@role='grid'][li[contains(@class, 'focused-element')]]",
                      "//ul[contains(translate(@aria-label, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'speaking')]"
                    ],
                    "method": "clickOption",
                    "values": {
                      "Native/Fluent": [
                        "Native/Fluent",
                        "High",
                        "Native",
                        "Fluent"
                      ],
                      "Advanced": [
                        "Advanced"
                      ],
                      "Intermediate": [
                        "Moderate",
                        "Medium",
                        "Intermediate"
                      ],
                      "Elementary": [
                        "Elementary",
                        "Begginer",
                        "Low"
                      ]
                    },
                    "options": {
                      "containerElement": "document",
                      "caseSentiveOption": true,
                      "waitForNetworkBeforeInteraction": true
                    }
                  }
                ]
              },
              {
                "keywords": [
                  "speaking"
                ]
              }
            ],
            [
              "reading",
              {
                "actions": [
                  {
                    "path": [
                      ".//input[contains(@aria-label, 'Reading') and contains(@id, 'filter')]"
                    ],
                    "method": "click",
                    "options": {
                      "waitForNetworkAfterInteraction": true,
                      "trackQuestion": true
                    },
                    "time": 500
                  },
                  {
                    "path": [
                      "//ul[@role='grid'][li[contains(@class, 'listview-item')]]",
                      "//ul[contains(translate(@aria-label, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'reading')]"
                    ],
                    "method": "clickOption",
                    "values": {
                      "Native/Fluent": [
                        "Native/Fluent",
                        "High",
                        "Native",
                        "Fluent"
                      ],
                      "Advanced": [
                        "Advanced"
                      ],
                      "Intermediate": [
                        "Moderate",
                        "Medium",
                        "Intermediate"
                      ],
                      "Elementary": [
                        "Elementary",
                        "Begginer",
                        "Low"
                      ]
                    },
                    "options": {
                      "containerElement": "document",
                      "caseSentiveOption": true,
                      "waitForNetworkBeforeInteraction": true
                    }
                  }
                ]
              },
              {
                "keywords": [
                  "reading"
                ]
              }
            ],
            [
              "writting",
              {
                "actions": [
                  {
                    "path": [
                      ".//input[contains(@aria-label, 'Writing') and contains(@id, 'filter')]"
                    ],
                    "method": "click",
                    "options": {
                      "waitForNetworkAfterInteraction": true,
                      "trackQuestion": true
                    },
                    "time": 500
                  },
                  {
                    "path": [
                      "//ul[@role='grid'][li[contains(@class, 'item-layout')]]",
                      "//ul[contains(translate(@aria-label, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'writing')]"
                    ],
                    "method": "clickOption",
                    "values": {
                      "Native/Fluent": [
                        "Native/Fluent",
                        "High",
                        "Native",
                        "Fluent"
                      ],
                      "Advanced": [
                        "Advanced"
                      ],
                      "Intermediate": [
                        "Moderate",
                        "Medium",
                        "Intermediate"
                      ],
                      "Elementary": [
                        "Elementary",
                        "Begginer",
                        "Low"
                      ]
                    },
                    "options": {
                      "containerElement": "document",
                      "caseSentiveOption": true,
                      "waitForNetworkBeforeInteraction": true
                    }
                  }
                ]
              },
              {
                "keywords": [
                  "reading",
                  "writting"
                ]
              }
            ],
            [
              "nextBtn",
              {
                "actions": [
                  {
                    "path": [
                      ".//button[contains(@data-qa, 'addTileItemDialogButton') or contains(@data-qa, 'addTimelineItemDialogButton')]",
                      "//button[contains(@class, 'save-btn') and .//span[normalize-space(text())='Add Language']]"
                    ],
                    "method": "click",
                    "options": {
                      "waitForNetworkAfterInteraction": true
                    }
                  }
                ]
              },
              {
                "keywords": [
                  "add"
                ]
              }
            ],
            [
              "checkErrors",
              {
                "actions": [
                  {
                    "path": [
                      ".//p[contains(@class, 'validation') and @role='alert']"
                    ],
                    "method": "checkForErrorsInModal",
                    "options": {
                      "removeButton": [
                        ".//button[contains(@data-bind, 'removeProfileItem')]"
                      ],
                      "waitForNetworkAfterInteraction": true
                    }
                  }
                ]
              },
              {
                "keywords": [
                  "cancel"
                ]
              }
            ]
          ]
        },
        {
          "keywords": [
            "languages",
            "language"
          ]
        }
      ]
    ]
  },
  "paylocity": {
    "atsName": "paylocity",
    "urls": [
      "*://recruiting.paylocity.com/Recruiting/Jobs/Apply/*",
      "*://recruiting.paylocity.com/Recruiting/Jobs/Success/*"
    ],
    "urlsExclude": [],
    "questionsInSubmitPage": true,
    "submitButtonPaths": [
      ".//button[@data-automation-id='btnSubmit']"
    ],
    "nextStepButtonPaths": [
      ".//button[@data-automation-id='btnNext']"
    ],
    "nextStepDynamicLoad": false,
    "formLoadingXPaths": [],
    "validationCheckFormValidity": false,
    "errorBannerXPaths": [],
    "validationErrorXPaths": [
      "//div[contains(@class, 'form-group') and contains(@class, 'form-error')]//div[contains(@class, 'type-footnote') and contains(@class, 'show')]"
    ],
    "validationErrorPersistent": false,
    "checkErrorsAfterSubmit": false,
    "confirmSubmittedForm": {
      "confirmMessageXPath": [
        ".//div[@id='appSubmitResponseDiv']"
      ],
      "urls": [
        "*://recruiting.paylocity.com/Recruiting/Jobs/Success/*"
      ]
    },
    "questionValidationErrorSelectors": [
      ".form-group.form-error:not(:has(input[id='info.email']))",
      "span[id*='error-message']"
    ],
    "validateUsingQuestionErrorSelectors": true,
    "targetNodeXPath": [
      ".//div[@id='applicant-tracking']"
    ],
    "targetFrameNodeXPath": [],
    "canJobBeAppliedXPaths": {
      "applyButton": [
        ".//a[contains(@class, 'apply-button') and CONTAINS_TEXT('apply')]"
      ],
      "submitButton": "",
      "email": [],
      "next": []
    },
    "customQuestions": {
      "useSelectorForCustomFields": true,
      "patterns": {
        "questionId": "",
        "innerSelectors": [],
        "selectInputXPath": [
          ".//div[@role='combobox']"
        ],
        "selectInputAttrName": "role",
        "selectInputAttrValue": "combobox",
        "selectInputTagNames": [
          "div"
        ],
        "radioGroupMatchQuerySelector": "",
        "fieldsetMatchQuerySelector": "div.multi-question",
        "maxLabelLevel": "",
        "radioGroupAttrName": "",
        "radioGroupAttrValue": "",
        "listboxTagName": "div"
      },
      "selectors": {
        "question": ".form-group",
        "questionParent": "",
        "questionXPath": [],
        "title": "span.job-apply-title",
        "subTitle": ".section-heading",
        "label": "label, .form-group p",
        "labelInputGroup": "",
        "legend": "legend",
        "ariaLabelledBy": "",
        "roleOption": "[role='option']",
        "radioInput": "input[type='radio']",
        "monthInput": "input[aria-valuetext='MM'], input[type='month']",
        "dateInput": "input[aria-valuetext='DD']",
        "yearInput": "input[aria-valuetext='YYYY']",
        "checkbox": "input[type='checkbox']",
        "optionsSelector": "div.drag-edit-radios"
      },
      "xpaths": {
        "currentListItem": [],
        "listInputBackBtnText": [],
        "selectPopupXPath": [
          ".//div[@role='combobox']"
        ],
        "listBoxPopupXPath": [
          ".//ul[@role='listbox']"
        ],
        "selectedItemListXPath": [],
        "requiredFieldXPath": [
          ".//div[contains(@class, 'form-required')]//label",
          ".//label[contains(., 'required')]/span"
        ],
        "targetNodeXPath": [
          ".//div[@id='applicant-tracking']"
        ]
      },
      "ignoreQuestions": [
        ".//input[contains(@data-qa-id, 'endDate') or contains(@id, 'endDate')]",
        ".//input[contains(@data-automation-id, 'infoMiddleName') or contains(@id, 'info.middleName')]",
        ".//input[contains(@class, 'react-tagsinput-input') or @id='info.skills']",
        ".//input[@data-automation-id='infoMaximumDesiredSalary' or @id='info.maximumDesiredSalary']",
        ".//input[contains(@data-automation-id, 'workHistoryCompanyUrl') or contains(@id, 'workHistory.companyUrl')]",
        ".//input[contains(@data-automation-id, 'workHistoryCompanyPhone') or contains(@id, 'workHistory.companyPhone')]"
      ],
      "ignoreContainerQuestions": [
        ".//div[contains(@class, 'form-group') and .//*[contains(@id, 'info.smsOptedIn')]]",
        ".//div[contains(@class, 'form-group') and .//*[contains(@id, 'educationHistory.country')]]",
        ".//div[contains(@class, 'form-group') and .//*[contains(@id, 'educationHistory.state')]]",
        ".//div[contains(@class, 'form-group') and .//*[contains(@id, 'info.dateAvailableToStart')]]",
        ".//div[contains(@class, 'form-group') and .//div[@data-automation-id='info.howDidYouHearAboutUs-wrapper']]"
      ]
    },
    "jobXPaths": {
      "entities": [
        [
          "titleDisplay",
          [
            ".//span[contains(@class,'title')]//span"
          ]
        ],
        [
          "originalCompanyName",
          [
            "//h2[@id='LayoutLogoName']/text()"
          ]
        ],
        [
          "jobTypes",
          []
        ],
        [
          "postingDate",
          []
        ],
        [
          "url",
          []
        ],
        [
          "desc",
          []
        ],
        [
          "locationDisplay",
          []
        ],
        [
          "location",
          []
        ]
      ]
    },
    "preApply": {
      "urls": [
        "*://recruiting.paylocity.com/Recruiting/Jobs/Details/*"
      ],
      "urlsExclude": [],
      "entities": [
        [
          "consent",
          {}
        ],
        [
          "phoneStrippedCountryCode",
          {}
        ],
        [
          "continueButton",
          {}
        ],
        [
          "chooseVerificationMethod",
          {}
        ],
        [
          "sendButton",
          {}
        ],
        [
          "applyBtn",
          {
            "actions": [
              {
                "key": "canJobBeAppliedXPaths.applyButton",
                "method": "click"
              }
            ]
          }
        ]
      ]
    },
    "sections": {
      "path": [
        ".//div[@class='section-heading'] | .//div[@id='appDetailDiv']//h2[not(@id='LayoutLogoName')]"
      ],
      "section": [
        {
          "title": [
            "Information"
          ],
          "entities": [
            "resume",
            "firstName",
            "lastName",
            "preferredFirstName",
            "email",
            "phone",
            "agreement",
            "addressLine1",
            "city",
            "county",
            "state",
            "postalCode",
            "answerSource",
            "workStartDateAvailabilityString",
            "minYearlySalaryDesired",
            "birthDate",
            "skill",
            "experience",
            "companyName",
            "title",
            "description",
            "city",
            "state",
            "isCurrent",
            "startDate",
            "endDate",
            "mayWeContact",
            "education",
            "name",
            "major",
            "city",
            "stateName",
            "isGraduated",
            "endDate"
          ]
        },
        {
          "title": [
            "Additional Questions",
            "Reference"
          ],
          "entities": []
        },
        {
          "title": [
            "Acknowledgement",
            "Optional Identity Questions",
            "Equal Employment Opportunity",
            "Work Authorization"
          ],
          "entities": [
            "gender",
            "genderPronouns",
            "race",
            "veteran",
            "disability",
            "workAuth"
          ]
        }
      ]
    },
    "entities": [
      [
        "applyBtn",
        {}
      ],
      [
        "resume",
        {
          "actions": [
            {
              "path": [
                ".//input[@type='checkbox' and @id='useAttachedResumeToFillOutApplication']"
              ],
              "method": "click"
            },
            {
              "path": [
                ".//input[@type='file' and @id='btn-resume']"
              ],
              "method": "uploadResume",
              "options": {
                "waitForNetworkAfterInteraction": true
              }
            }
          ]
        }
      ],
      [
        "firstName",
        [
          ".//input[@data-automation-id='infoFirstName' or @id='info.firstName']"
        ]
      ],
      [
        "lastName",
        [
          ".//input[@data-automation-id='infoLastName' or @id='info.lastName']"
        ]
      ],
      [
        "preferredFirstName",
        [
          ".//input[@data-automation-id='infoPreferredName' or @id='info.preferredName']"
        ]
      ],
      [
        "legalFirstName",
        []
      ],
      [
        "legalLastName",
        []
      ],
      [
        "fullName",
        []
      ],
      [
        "email",
        [
          ".//input[@data-automation-id='infoEmail' or @id='info.email']"
        ]
      ],
      [
        "phone",
        [
          ".//input[@data-automation-id='infoCellPhone' or @id='info.cellPhone']"
        ]
      ],
      [
        "agreement",
        {
          "actions": [
            {
              "path": [
                ".//div[@aria-owns='info.smsOptedIn__listbox']"
              ],
              "method": "click"
            },
            {
              "path": [
                ".//ul[@id='info.smsOptedIn__listbox']"
              ],
              "method": "clickOption",
              "options": {
                "fallbackOption": "No"
              }
            }
          ]
        }
      ],
      [
        "country",
        []
      ],
      [
        "addressLine1",
        {
          "actions": [
            {
              "path": [
                ".//input[@data-automation-id='public-site-address-address-1' or @id='public-site-address-address-1']"
              ],
              "method": "setValue",
              "options": {
                "triggerKeyDownEvent": true,
                "triggerBlurEvent": false,
                "waitForNetworkAfterInteraction": true,
                "quietPeriod": 500
              }
            },
            {
              "path": [
                ".//ul[@data-automation-id='public-site-address-address-1-input-select-dropdown-list-container' or @id='public-site-address-address-1-input-select-dropdown-list-container']"
              ],
              "method": "clickOptionAsync",
              "options": {
                "similarMatch": true
              }
            }
          ]
        }
      ],
      [
        "city",
        [
          ".//input[@data-automation-id='public-site-address-city' or @id='public-site-address-city']"
        ]
      ],
      [
        "county",
        {
          "actions": [
            {
              "path": [
                ".//input[@data-automation-id='public-site-address-county' or @id='public-site-address-county']"
              ],
              "method": "getCounty"
            },
            {
              "path": [
                ".//input[@data-automation-id='public-site-address-county' or @id='public-site-address-county']"
              ],
              "method": "setValue",
              "options": {
                "waitForNetworkBeforeInteraction": true
              }
            }
          ]
        }
      ],
      [
        "state",
        {
          "actions": [
            {
              "path": [
                ".//div[@data-automation-id='public-site-address-us-state-input-base' and @id='public-site-address-us-state-select-wrapper']"
              ],
              "method": "click"
            },
            {
              "path": [
                ".//div[@data-automation-id='public-site-address-us-state-input-select-dropdown-list-container' or @id='public-site-address-us-state-dropdown-list-container']"
              ],
              "method": "clickOption"
            }
          ]
        }
      ],
      [
        "stateName",
        []
      ],
      [
        "postalCode",
        [
          ".//input[@data-automation-id='public-site-address-zip' or @id='public-site-address-zip']"
        ]
      ],
      [
        "answerSource",
        {
          "actions": [
            {
              "path": [
                ".//div[@data-automation-id='info.howDidYouHearAboutUs-wrapper']"
              ],
              "method": "clickOption",
              "defaultValue": "Other",
              "values": {
                "source": [
                  "Other",
                  "Internet",
                  "Google"
                ]
              }
            },
            {
              "path": [
                ".//input[@data-automation-id='info.howDidYouHearAboutUs' or @id='info.howDidYouHearAboutUs']"
              ],
              "method": "setValue",
              "defaultValue": "Job Board"
            }
          ]
        }
      ],
      [
        "cityStateName",
        []
      ],
      [
        "over18",
        []
      ],
      [
        "workStartDateAvailabilityString",
        {
          "actions": [
            {
              "method": "setDateInput",
              "format": "MM/dd/yyyy",
              "fullDate": {
                "path": [
                  ".//input[@id='info.dateAvailableToStart']"
                ],
                "format": "yyyy-MM-dd"
              }
            }
          ]
        }
      ],
      [
        "minYearlySalaryDesired",
        {
          "actions": [
            {
              "path": [
                ".//input[@data-automation-id='infoDesiredSalaryDescription' or @id='info.desiredSalaryDescription']",
                ".//input[@data-automation-id='infoMinimumDesiredSalary' or @id='info.minimumDesiredSalary']"
              ],
              "method": "setValue",
              "userDataParam": "__minYearlySalaryDesired__"
            }
          ]
        }
      ],
      [
        "birthDate",
        {
          "actions": [
            {
              "method": "setDateInput",
              "format": "MM/dd/yyyy",
              "fullDate": {
                "path": [
                  ".//input[@id='info.birthDate']"
                ],
                "format": "yyyy-MM-dd"
              }
            }
          ]
        }
      ],
      [
        "skill",
        {
          "containerPath": [
            ".//div[contains(@class, 'react-tagsinput') and .//input[@id='info.skills']]"
          ],
          "entities": [
            [
              "name",
              [
                {
                  "actions": [
                    {
                      "path": [
                        ".//input[@id='info.skills']"
                      ],
                      "method": "setValue"
                    },
                    {
                      "path": [
                        ".//input[@id='info.skills']"
                      ],
                      "method": "pressEnterKey"
                    }
                  ]
                }
              ]
            ]
          ],
          "options": {
            "clickOutsideAtEnd": false
          }
        }
      ],
      [
        "recentExperience.companyName",
        []
      ],
      [
        "recentExperience.title",
        []
      ],
      [
        "experience",
        {
          "addButtonPath": [
            ".//button[@data-automation-id='btnAddWorkHistory']"
          ],
          "confirmAddedPath": [
            "(//div[contains(@class, 'work-history-group')])[__indexPlusOne__]"
          ],
          "containerPath": [
            "(//div[contains(@class, 'work-history-group')])[__indexPlusOne__]"
          ],
          "entities": [
            [
              "companyName",
              [
                "//input[@data-automation-id='workHistoryCompanyName__index__' or @id='workHistory.companyName.__index__']"
              ]
            ],
            [
              "title",
              [
                "//input[@data-automation-id='workHistoryPosition__index__' or @id='workHistory.position.__index__']"
              ]
            ],
            [
              "description",
              [
                "//textarea[@id='workHistory.responsibilities.__index__']"
              ]
            ],
            [
              "city",
              [
                "//input[@data-automation-id='public-candidate-work-history-address-__index__-city' or @id='public-candidate-work-history-address-__index__-city']"
              ]
            ],
            [
              "state",
              {
                "actions": [
                  {
                    "path": [
                      "//label[@data-automation-id='public-candidate-work-history-address-__index__-us-state-label-span']"
                    ],
                    "method": "click"
                  },
                  {
                    "path": [
                      "//input[@id='public-candidate-work-history-address-__index__-us-state']"
                    ],
                    "method": "setValue",
                    "options": {
                      "triggerKeyDownEvent": true,
                      "triggerKeyUpEvent": true,
                      "triggerBlurEvent": false,
                      "triggerFocusEvent": true,
                      "triggerFocusInEvent": true
                    },
                    "time": 600
                  },
                  {
                    "path": [
                      "//div[@data-automation-id='public-candidate-work-history-address-__index__-us-state-input-select-dropdown-list-container' or @id='public-candidate-work-history-address-__index__-us-state-dropdown-list-container']"
                    ],
                    "method": "clickOption",
                    "options": {
                      "containerElement": "document",
                      "similarMatch": true
                    }
                  }
                ]
              }
            ],
            [
              "isCurrent",
              {
                "actions": [
                  {
                    "path": [
                      "//input[@id='workHistory.currentlyWorkingHere.__index__']"
                    ],
                    "method": "clickCheckbox"
                  }
                ]
              }
            ],
            [
              "startDate",
              {
                "actions": [
                  {
                    "method": "setDateInput",
                    "format": "MM/yyyy",
                    "fullDate": {
                      "path": [
                        "(//input[contains(@data-qa-id, 'startDate') or contains(@id, 'startDate')])[__indexPlusOne__]"
                      ],
                      "format": "MM/yyyy"
                    }
                  }
                ]
              }
            ],
            [
              "endDate",
              {
                "actions": [
                  {
                    "method": "setDateInput",
                    "format": "MM/yyyy",
                    "fullDate": {
                      "path": [
                        "(//input[contains(@data-qa-id, 'endDate') or contains(@id, 'endDate')])[__indexPlusOne__]"
                      ],
                      "format": "MM/yyyy"
                    }
                  }
                ]
              }
            ],
            [
              "mayWeContact",
              {
                "actions": [
                  {
                    "path": [
                      "//div[@id='workHistory.mayWeContactSupervisor.__index__' or @aria-owns='workHistory.mayWeContactSupervisor.__index____listbox']"
                    ],
                    "method": "click"
                  },
                  {
                    "path": [
                      ".//ul[@id='workHistory.mayWeContactSupervisor.__index____listbox']"
                    ],
                    "method": "clickOption",
                    "values": {
                      "true": [
                        "Yes"
                      ],
                      "false": [
                        "No"
                      ]
                    },
                    "options": {
                      "fallbackOption": "No",
                      "forceFallbackOption": true
                    }
                  }
                ]
              }
            ]
          ]
        }
      ],
      [
        "weekdaysAvailability",
        {}
      ],
      [
        "weekendsAvailability",
        []
      ],
      [
        "openSchedule",
        {}
      ],
      [
        "flexibleSchedule",
        {}
      ],
      [
        "dayShift",
        {}
      ],
      [
        "nightShift",
        {}
      ],
      [
        "swingShift",
        {}
      ],
      [
        "overnightShift",
        {}
      ],
      [
        "anyShift",
        {}
      ],
      [
        "highestEducationLevel",
        []
      ],
      [
        "education",
        {
          "addButtonPath": [
            ".//button[@data-automation-id='btnAddEducationHistory']"
          ],
          "confirmAddedPath": [
            "(//div[contains(@class, 'education-history-group')])[__indexPlusOne__]"
          ],
          "containerPath": [
            "(//div[contains(@class, 'education-history-group')])[__indexPlusOne__]"
          ],
          "entities": [
            [
              "name",
              [
                ".//input[@data-automation-id='educationHistoryName__index__' or @id='educationHistory.name.__index__']"
              ]
            ],
            [
              "major",
              [
                ".//input[@data-automation-id='educationAreaOfStudy__index__' or @id='educationHistory.areaOfStudy.__index__']",
                ".//input[@data-automation-id='educationHistoryAreaOfStudy__index__']"
              ]
            ],
            [
              "degree",
              {}
            ],
            [
              "startDateMonth_MM",
              []
            ],
            [
              "endDateMonth_MM",
              []
            ],
            [
              "startDateMonthText",
              []
            ],
            [
              "endDateMonthText",
              []
            ],
            [
              "startDateYear",
              []
            ],
            [
              "endDateYear",
              []
            ],
            [
              "city",
              [
                ".//input[@data-automation-id='educationHistoryCity__index__' or @id='educationHistory.city.__index__']"
              ]
            ],
            [
              "stateName",
              {
                "actions": [
                  {
                    "path": [
                      ".//div[@id='educationHistory.state.__index__' or @aria-owns='educationHistory.state.__index____listbox']"
                    ],
                    "method": "click"
                  },
                  {
                    "path": [
                      "//ul[@id='educationHistory.state.__index____listbox']"
                    ],
                    "method": "clickOption"
                  }
                ]
              }
            ],
            [
              "isGraduated",
              {
                "actions": [
                  {
                    "path": [
                      "//div[@id='educationHistory.didYouGraduate.__index__' or @aria-owns='educationHistory.didYouGraduate.__index____listbox']"
                    ],
                    "method": "click"
                  },
                  {
                    "path": [
                      "//ul[@id='educationHistory.didYouGraduate.__index____listbox']"
                    ],
                    "method": "clickOption",
                    "values": {
                      "true": [
                        "Yes"
                      ],
                      "false": [
                        "No"
                      ],
                      "": [
                        "Yes"
                      ]
                    }
                  }
                ]
              }
            ],
            [
              "endDate",
              {
                "actions": [
                  {
                    "method": "setDateInput",
                    "format": "MM/yyyy",
                    "fullDate": {
                      "path": [
                        "//input[@id='txt-educationHistory-graduationDate-__index__' or @data-automation-id='txt-educationHistory-graduationDate-__index__']"
                      ],
                      "format": "MM/yyyy"
                    }
                  }
                ]
              }
            ]
          ]
        }
      ],
      [
        "workAuth",
        {
          "actions": [
            {
              "path": [
                ".//div[@id='acknowledgements.authorizedToWorkInUs']"
              ],
              "method": "click"
            },
            {
              "path": [
                ".//ul[@id='acknowledgements.authorizedToWorkInUs__listbox']"
              ],
              "method": "clickOption",
              "values": {
                "true": [
                  "Yes"
                ],
                "false": [
                  "No"
                ],
                "": [
                  "Yes"
                ]
              }
            }
          ]
        }
      ],
      [
        "sponsorship",
        {}
      ],
      [
        "lift50PoundsWeightAbility",
        {}
      ],
      [
        "gender",
        {
          "actions": [
            {
              "path": [
                ".//div[@id='acknowledgements.eeoGender']"
              ],
              "method": "click"
            },
            {
              "path": [
                ".//ul[@id='acknowledgements.eeoGender__listbox']"
              ],
              "method": "clickOption",
              "values": {
                "Male": [
                  "Male",
                  "Man"
                ],
                "Female": [
                  "Female",
                  "Woman"
                ],
                "I do not want to answer": [
                  "Decline",
                  "I don't wish",
                  "Prefer not"
                ],
                "": [
                  "Decline",
                  "I don't wish",
                  "Prefer not"
                ]
              }
            }
          ]
        }
      ],
      [
        "hispanicLatino",
        {}
      ],
      [
        "genderPronouns",
        {
          "actions": [
            {
              "path": [
                ".//input[@aria-autocomplete='list' and @id='pronounOptions']"
              ],
              "method": "pressEnterKey"
            },
            {
              "path": [
                ".//input[@aria-autocomplete='list' and @id='pronounOptions']"
              ],
              "method": "setValue",
              "options": {
                "triggerKeyDownEvent": true,
                "triggerKeyUpEvent": true,
                "triggerBlurEvent": false,
                "triggerFocusEvent": true,
                "triggerFocusInEvent": true
              },
              "time": 600
            },
            {
              "path": [
                ".//div[@data-automation-id='pronounOptions-input-select-dropdown-list-container' or @id='pronounOptions-dropdown-list-container']"
              ],
              "method": "clickOption",
              "values": {
                "He/him/his": [
                  "he"
                ],
                "She/her/hers": [
                  "she"
                ],
                "They/them/theirs": [
                  "they"
                ],
                "Ze/hir/hirs": [
                  "ze"
                ],
                "Xe/xem/xyrs": [
                  "xe"
                ],
                "Ey/em/eirs": [
                  "ey"
                ],
                "Ve/ver/vis": [
                  "ve"
                ],
                "Per/per/pers": [
                  "per"
                ],
                "Ne/nem/nirs": [
                  "ne"
                ],
                "Other": [
                  "other"
                ],
                "I do not want to answer": [
                  "Decline",
                  "I don't wish",
                  "Prefer not"
                ],
                "": [
                  "Decline",
                  "I don't wish",
                  "Prefer not"
                ]
              }
            }
          ]
        }
      ],
      [
        "transgender",
        {}
      ],
      [
        "race",
        {
          "actions": [
            {
              "path": [
                ".//div[@id='acknowledgements.racialOrEthnicGroup']"
              ],
              "method": "click",
              "options": {
                "isRepeatedAcrossSteps": true
              }
            },
            {
              "path": [
                ".//input[@aria-autocomplete='list' and @id='ethnicityOptions']"
              ],
              "method": "pressEnterKey"
            },
            {
              "path": [
                ".//input[@aria-autocomplete='list' and @id='ethnicityOptions']"
              ],
              "method": "setValue",
              "options": {
                "triggerKeyDownEvent": true,
                "triggerKeyUpEvent": true,
                "triggerBlurEvent": false,
                "triggerFocusEvent": true,
                "triggerFocusInEvent": true
              },
              "time": 600
            },
            {
              "path": [
                ".//ul[@id='acknowledgements.racialOrEthnicGroup__listbox']",
                ".//div[@data-automation-id='ethnicityOptions-input-select-dropdown-list-container' or @id='ethnicityOptions-dropdown-list-container']"
              ],
              "method": "clickOption",
              "options": {
                "containerElement": "document",
                "caseSentiveOption": true
              },
              "values": {
                "Black or African American": [
                  "Black",
                  "African"
                ],
                "East Asian": [
                  "East Asian",
                  "Asian"
                ],
                "Hispanic or Latino": "Hispanic",
                "Southeast Asian": [
                  "Southeast Asian",
                  "Asian"
                ],
                "South Asian": [
                  "South Asian",
                  "Asian"
                ],
                "Native Hawaiian or Other Pacific Islander": [
                  "Native Hawaiian",
                  "Pacific Islander"
                ],
                "American Indian or Alaska Native": [
                  "American Indian",
                  "Alaskan Native"
                ],
                "White": "White",
                "Two or More Races": "Two or More",
                "Some Other Race": [
                  "Other",
                  "Decline"
                ],
                "Decline to Answer": [
                  "Decline",
                  "Prefer not"
                ],
                "": [
                  "Decline"
                ]
              }
            }
          ]
        }
      ],
      [
        "veteran",
        {
          "actions": [
            {
              "path": [
                ".//div[@id='acknowledgements.militaryService']"
              ],
              "method": "click"
            },
            {
              "path": [
                ".//ul[@id='acknowledgements.militaryService__listbox']"
              ],
              "method": "clickOption",
              "values": {
                "true": [
                  "I am a ",
                  "I identify ",
                  "Yes"
                ],
                "false": [
                  "I am not a ",
                  "I don't ",
                  "No",
                  "Prefer not"
                ],
                "": [
                  "Decline",
                  "I am not a ",
                  "I don't ",
                  "No",
                  "Prefer not"
                ]
              }
            }
          ]
        }
      ],
      [
        "disability",
        {
          "actions": [
            {
              "path": [
                ".//div[@id='acknowledgements.disability']"
              ],
              "method": "click"
            },
            {
              "path": [
                ".//ul[@id='acknowledgements.disability__listbox']"
              ],
              "method": "clickOption",
              "values": {
                "true": [
                  "Yes",
                  "I have"
                ],
                "false": [
                  "No",
                  "I do not have",
                  "Prefer not"
                ],
                "": [
                  "Decline",
                  "I don't wish",
                  "Prefer not",
                  "No"
                ]
              }
            }
          ]
        }
      ],
      [
        "sexualOrientation",
        {}
      ],
      [
        "linkedin",
        []
      ],
      [
        "github",
        []
      ],
      [
        "twitter",
        []
      ],
      [
        "behance",
        []
      ],
      [
        "countryName",
        []
      ],
      [
        "phoneStripped",
        []
      ],
      [
        "phoneCode",
        []
      ],
      [
        "deviceType",
        {}
      ],
      [
        "certification",
        {
          "addButtonPath": [],
          "confirmAddedPath": [],
          "containerPath": [],
          "entities": [
            [
              "name",
              []
            ],
            [
              "issueDateSlashes_MMDDYYYY",
              []
            ]
          ]
        }
      ],
      [
        "lgbt",
        {}
      ],
      [
        "armedForces",
        {}
      ],
      [
        "currentDate.dateString",
        {}
      ],
      [
        "currentDateDashes",
        {}
      ],
      [
        "language",
        {}
      ],
      [
        "privacyAgreement",
        {}
      ],
      [
        "middleName",
        {}
      ],
      [
        "street",
        []
      ],
      [
        "cityLocated",
        []
      ],
      [
        "phoneType",
        {}
      ],
      [
        "phoneFormatted",
        []
      ],
      [
        "homePhoneFormatted",
        []
      ],
      [
        "referral",
        {}
      ],
      [
        "applyDate",
        {}
      ],
      [
        "birthMonth",
        {}
      ],
      [
        "birthDay",
        {}
      ],
      [
        "birthYear",
        {}
      ],
      [
        "addressType",
        {}
      ],
      [
        "startMonthAvailabilityString",
        {}
      ],
      [
        "startDayAvailabilityString",
        {}
      ],
      [
        "startYearAvailabilityString",
        []
      ],
      [
        "nameInitials",
        []
      ],
      [
        "addressLine2",
        []
      ],
      [
        "highestEducation.name",
        []
      ],
      [
        "highestEducation.degreeDisplay",
        []
      ],
      [
        "workStartDateAvailability",
        []
      ],
      [
        "currencyType",
        {}
      ],
      [
        "willingToWorkHolidays",
        {}
      ],
      [
        "employmentInvoluntarilyTerminated",
        {}
      ],
      [
        "startMonthNameAvailabilityString",
        {}
      ],
      [
        "cityState",
        {}
      ]
    ],
    "globalOptions": {
      "waitForAllRequestsBeforeFillingStep": false
    },
    "signIn": {
      "urls": [],
      "formPath": [],
      "submitButton": [],
      "toSignInButton": [],
      "createAccount": [],
      "forgotPassword": [],
      "email": [],
      "password": [],
      "errorMessage": [],
      "endpoint": "",
      "verifyPassword": [],
      "isInlineForm": false,
      "isEmailRequired": false,
      "errorPersistAfterReload": false
    },
    "signUp": {
      "errorMessage": [],
      "submitButton": [],
      "formStepPath": [],
      "email": [],
      "password": [],
      "verifyPassword": [],
      "endpoint": "",
      "saveStrategy": "",
      "urls": [],
      "verifyEmail": [],
      "userName": []
    },
    "nextStepButtonFallbackToParentFrame": false,
    "attachedContainer": [],
    "alwaysSyncWindowId": false
  },
  "taleo": {
    "atsName": "taleo",
    "urls": [
      "*://*.taleo.net/*/application*",
      "*://*.taleo.net/*/jobdetail.ftl*",
      "*://*.taleo.net/*/flow.jsf*",
      "*://*.taleo.net/*/jobapply*",
      "*://*.taleo.net/*/ats/careers/*",
      "*://*.taleo.net/*/htmlResourceViewer.jss*",
      "*://*.taleo.net/careersection/careersection*",
      "*://*.taleo.net/*/login*",
      "*://*.taleo.net/*/register*",
      "*://*.taleo.net/careersection/*/*/changeQuestionsAnswers*"
    ],
    "urlsExclude": [],
    "submitButtonPaths": [
      ".//input[@type='button' and contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'submitcmd')]"
    ],
    "networkOptions": {
      "blacklistedUrlParts": [
        "linkedin",
        "analytics",
        "insights",
        "track"
      ]
    },
    "nextStepButtonPaths": [
      ".//button[@id='et-ef-content-ftf-saveContinueCmdBottom' and contains(., 'Continue')]",
      ".//input[contains(@id, 'saveContinueCmd')]",
      ".//button[contains(@id, 'saveContinueCmd')]",
      ".//input[contains(@id, 'saveContinueCmdBottom')]",
      ".//input[contains(@value, 'Apply Online')]",
      ".//input[contains(@value, 'Quick Apply')]",
      ".//input[contains(@id, 'UP_APPLY_ON_REQ')]",
      ".//input[contains(@value, 'Save and Continue')]",
      ".//input[@title='continue']",
      ".//input[@title='Continue']"
    ],
    "nextStepButtonFallbackToParentFrame": true,
    "validationErrorPersistent": true,
    "validationErrorXPaths": [
      "//span[contains(@class, 'error-label') and contains(@role, 'presentation')]",
      "//span[contains(translate(@class,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'notification') and not(contains(@style, 'display: none'))]//span[contains(translate(.,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'action cannot be completed')]"
    ],
    "stepsNavigation": {
      "containerPath": [
        "//table[@class='datatrain-table']"
      ],
      "stepSelector": [
        "li:has(div[class*='datatrain-no-focus'])"
      ],
      "stepClickableSelector": [
        "[class*='datatrain-no-focus'] a"
      ],
      "activeStepSelector": [
        "li:has(div[class*='datatrain-focus'])"
      ]
    },
    "errorBannerXPaths": [],
    "targetNodeXPath": [
      "//div[@id='taleo_holder']",
      ".//table[@class='tablelist' and not(.//iframe[@id='document-html-viewer'])]",
      "//body[contains(@id, 'home')]",
      ".//form[@id='dialogTemplate-dialogForm']",
      "//span[@id='et-ef-masterbody' and not(.//iframe[@id='document-html-viewer'])]"
    ],
    "targetFrameNodeXPath": [
      "//div[@class='html-document-wrapper']",
      "//iframe[@id='document-html-viewer']"
    ],
    "questionValidationErrorSelectors": [
      "img[src*='inputWarning']"
    ],
    "canJobBeAppliedXPaths": {
      "applyButton": [
        ".//input[contains(@value, 'Apply Online')]",
        ".//input[contains(@value, 'Quick Apply')]",
        ".//input[contains(@value, 'Apply') and @type != 'hidden' and not(translate(@value, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz') = 'apply as guest')]",
        "//input[contains(@title, 'Apply') and not(translate(@value, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz') = 'apply as guest')]",
        "//input[contains(@title, 'Submit')]"
      ]
    },
    "confirmSubmittedForm": {
      "confirmMessageXPath": [
        ".//span[contains(@class, 'mainsection')]//span[contains(@id, 'thankYouBlock')]"
      ]
    },
    "signIn": {
      "urls": [
        "*://*.taleo.net/*/login*",
        "*://*.taleo.net/*/statementBeforeAuthentification*"
      ],
      "isEmailRequired": false,
      "submitButton": [
        "//input[contains(@id, 'dialogTemplate-dialogForm-login-defaultCmd') and contains(translate(@value, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'login')]",
        "//input[contains(@id, 'dialogTemplate-dialogForm-login-defaultCmd') and contains(translate(@value, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'sign in')]"
      ],
      "createAccount": [
        "//input[contains(@id, 'dialogTemplate-dialogForm-login-register') and not(translate(@value, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz') = 'apply as guest')]"
      ],
      "forgotPassword": [
        "//a[contains(@id, 'dialogTemplate-dialogForm-login-forgotPasswordLinkBottom')]"
      ],
      "email": [
        "//input[contains(@id, 'dialogTemplate-dialogForm-login-name1')]"
      ],
      "password": [
        "//input[contains(@id, 'dialogTemplate-dialogForm-login-password')]"
      ],
      "errorMessage": [
        "//div[contains(@id, 'errorIAM')]"
      ],
      "wrongCredentialsError": [
        "//div[contains(@id, 'errorIAM') and CONTAINS_TEXT('user', true) and CONTAINS_TEXT('cannot', true)]"
      ],
      "endpoint": "/login"
    },
    "signUp": {
      "urls": [
        "*://*.taleo.net/*/register*"
      ],
      "errorMessage": [
        "//div[contains(@id, 'errorIAM')]"
      ],
      "submitButton": [
        "//input[contains(@id, 'dialogTemplate-dialogForm-defaultCmd') and @value='Register']",
        "//input[contains(@id, 'dialogTemplate-dialogForm-defaultCmd') and @value='Next Step']",
        "//input[contains(@id, 'dialogTemplate-dialogForm-defaultCmd') and @value='Create my account']",
        "//input[contains(@id, 'dialogTemplate-dialogForm-defaultCmd') and @value='Create Account']"
      ],
      "email": [
        "//input[contains(@id, 'dialogTemplate-dialogForm-email')]"
      ],
      "verifyEmail": [
        "//input[contains(@id, 'dialogTemplate-dialogForm-emailConfirm')]"
      ],
      "password": [
        "//input[contains(@id, 'dialogTemplate-dialogForm-password')]"
      ],
      "verifyPassword": [
        "//input[contains(@id, 'dialogTemplate-dialogForm-passwordConfirm')]"
      ],
      "userName": [
        "//input[contains(@id, 'dialogTemplate-dialogForm-userName')]",
        "//input[contains(@id, 'dialogTemplate-dialogForm-login-name1')]"
      ],
      "endpoint": "/register",
      "saveStrategy": "onNextStep"
    },
    "customQuestions": {
      "patterns": {
        "questionId": "-qr"
      },
      "selectors": {
        "title": "span.title",
        "question": "fieldset[class], select[class], input[id][type='text'], textarea[class], table[id='dayPanel'], select[id*='AvailabilityDate'], select[class='input-select']",
        "label": "label[for*='__questionId__']",
        "legend": "legend",
        "ariaLabelledBy": "label[for^=__labelFor__]",
        "roleOption": "[role='option'], option",
        "radioInput": "input[type='radio']",
        "monthInput": "input[aria-valuetext='MM']",
        "dateInput": "input[aria-valuetext='DD']",
        "yearInput": "input[aria-valuetext='YYYY']",
        "checkbox": "input[type='checkbox']"
      },
      "xpaths": {
        "currentListItem": [],
        "listInputBackBtnText": [],
        "selectPopupXPath": [],
        "listBoxPopupXPath": [],
        "selectedItemListXPath": [],
        "requiredFieldXPath": [
          ".//img[@class='mandatory-img']",
          "//span[@style='visibility: visible;']//textarea[contains(@id, 'questionExplanationText')]"
        ],
        "requiredTextContent": [
          "required",
          "mandatory",
          "if yes",
          "please enter N/A"
        ]
      },
      "ignoreQuestions": [
        "//input[contains(@name, 'skipResumeUpload')]",
        "//input[contains(@name, 'resumeSkipRadio')]",
        "//fieldset[contains(@onclick, 'forceSubmit') and .//input[contains(@name, 'skipResumeUpload')]]",
        "//fieldset[contains(@onclick, 'forceSubmit') and .//input[contains(@name, 'resumeSkipRadio')]]",
        "//fieldset[contains(@onclick, 'forceSubmit') and .//input[contains(@name, 'resumeUploadRadio')]]",
        "//fieldset[contains(@onclick, 'forceSubmit') and .//input[contains(@name, 'pasteResumeRadio')]]",
        "//fieldset[.//fieldset[contains(@onclick, 'forceSubmit') and .//input[contains(@name, 'skipResumeUpload')]]]",
        "//fieldset[.//fieldset[contains(@onclick, 'forceSubmit') and .//input[contains(@name, 'resumeSkipRadio')]]]",
        "//fieldset[.//fieldset[contains(@onclick, 'forceSubmit') and .//input[contains(@name, 'resumeUploadRadio')]]]",
        "//fieldset[.//fieldset[contains(@onclick, 'forceSubmit') and .//input[contains(@name, 'pasteResumeRadio')]]]",
        "//select[contains(@id, 'education_StudyLevel')]",
        "//input[contains(@id, 'graduationDateProjected')]",
        "//textarea[contains(@id,'pastedResume')]",
        "//fieldset[contains(@class, 'input') and contains(@class, 'date') and contains(@class, 'time') and contains(., 'Graduation') and contains(., 'Anticipated') and contains(., 'Date')]",
        "//fieldset[.//input[contains(@name, 'resumeUploadRadio')]]",
        "//input[contains(@id, 'careerSectionReferenceForm')]",
        "//select[contains(@id, 'careerSectionReferenceForm')]",
        "//select[contains(@id, 'recruitmentSourceType')]",
        "//fieldset[.//input[contains(@id, 'ResumeParsingBlock-UploadResumeBlock-resumePasteRadio')][contains(@onclick, 'forceSubmit()')]]",
        "//fieldset[contains(@class, 'fs-508-inline')][.//input[contains(@id, 'experience_JobFunction')]]",
        "//fieldset[contains(@id, 'we-wei')][.//input[contains(@id, 'Employer')]]",
        ".//input[contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '_supervisor')]",
        ".//input[contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '_supervisortitle')]",
        ".//input[contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '_supervisorphone')]",
        ".//input[contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '_supervisoremail')]",
        ".//input[contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'experience_supervisorphone')]",
        ".//input[contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '_reference_')]",
        ".//input[contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '_reference_title')]",
        ".//input[contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '_reference_firstname')]",
        ".//input[contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '_reference_lastname')]",
        "//input[contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'reference_company')]",
        ".//input[contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '_reference_relationship')]",
        ".//input[contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '_reference_phone')]",
        ".//input[contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '_reference_email')]",
        "//select[contains(@name, 'OneMenu_language') and @onchange='forceSubmit()']",
        "//fieldset[@class='no-border']"
      ],
      "ignoreContainerQuestions": [
        ".//span[@class='textindentpanel'][select[contains(@id, 'diversityBlock') and contains(translate(@title, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'gender')]]",
        ".//span[@class='textindentpanel'][select[contains(@id, 'diversityBlock') and contains(translate(@title, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'veteran')]]",
        ".//span[@class='textindentpanel'][select[contains(@id, 'diversityBlock') and contains(translate(@title, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'race')]]"
      ]
    },
    "jobXPaths": {
      "entities": [
        [
          "titleDisplay",
          [
            ".//span[@class='metalink2']/a"
          ]
        ],
        [
          "originalCompanyName",
          []
        ],
        [
          "jobTypes",
          []
        ],
        [
          "postingDate",
          []
        ],
        [
          "url",
          []
        ],
        [
          "desc",
          []
        ],
        [
          "locationDisplay",
          []
        ]
      ]
    },
    "attachedContainer": [
      "//table[@summary='This section displays basic information regarding the files attached to the candidate record.']",
      "//table[@summary='You can attach a maximum of 25 files to use in your job submission(s).']",
      "//table[contains(@class, 'attachment-list') and not(contains(@class, 'empty-list'))]"
    ],
    "contextData": {
      "classifier": {
        "applyBtnPath": [
          "//a[contains(@href, 'taleo.net/careersection') and (CONTAINS_TEXT('apply', true) or contains(@class, 'apply'))]"
        ]
      },
      "options": {}
    },
    "preApply": {
      "urls": [
        "*://*.taleo.net/*/careersection/application.jss*"
      ],
      "entities": [
        [
          "consent",
          {
            "actions": [
              {
                "path": [
                  "//input[contains(@id, 'dialogTemplate-dialogForm-StatementBeforeAuthentificationContent-ContinueButton')]"
                ],
                "method": "click",
                "time": 500
              }
            ]
          }
        ]
      ]
    },
    "sections": {
      "path": [
        "//span[contains(@class, 'titlepage')]",
        "//h1[@class='heading']"
      ],
      "section": [
        {
          "title": [
            "Resume",
            "Attachment",
            "Document",
            "Attach A File",
            "Getting Started"
          ],
          "entities": [
            "resume"
          ]
        },
        {
          "title": [
            "Personal Information",
            "Tell Us About Yourself"
          ],
          "entities": [
            "answerSource",
            "email",
            "firstName",
            "lastName",
            "preferredFirstName",
            "middleName",
            "street",
            "cityLocated",
            "addressLine1",
            "birthDate",
            "phoneType",
            "phoneFormatted",
            "homePhoneFormatted",
            "homePhoneStripped",
            "phoneStripped",
            "workPhoneStripped",
            "phoneCode",
            "country",
            "county",
            "stateName",
            "state",
            "city",
            "postalCode",
            "preferredPhone",
            "education",
            "experience",
            "companyName",
            "title",
            "city",
            "stateName",
            "description",
            "startDateMonthText",
            "startDateYear",
            "endDateMonthText",
            "endDateYear",
            "isCurrent",
            "country",
            "stateName",
            "city",
            "certification",
            "name",
            "issueDateMonthText",
            "issueDateYear",
            "reference",
            "reasonLeaving",
            "supervisor"
          ]
        },
        {
          "title": [
            "Quick Apply"
          ],
          "entities": [
            "firstName",
            "lastName",
            "phoneFormatted",
            "email"
          ]
        },
        {
          "title": [
            "General",
            "Pre-Employment",
            "Pre-Screening"
          ],
          "entities": [
            "over18"
          ]
        },
        {
          "title": [
            "Education",
            "Work",
            "Experience",
            "Certifications",
            "Employment History"
          ],
          "entities": [
            "education",
            "name",
            "degree",
            "major",
            "country",
            "stateName",
            "city",
            "isGraduated",
            "studentName",
            "startDateMonthText",
            "startDateDashes_YYYYMMDD",
            "endDateDashes_YYYYMMDD",
            "startDateYear",
            "endDateMonthText",
            "endDateYear",
            "gpa",
            "antecipatedGraduationDate",
            "experience",
            "companyName",
            "title",
            "city",
            "stateName",
            "description",
            "startDateMonthText",
            "startDateYear",
            "endDateMonthText",
            "endDateYear",
            "isCurrent",
            "country",
            "stateName",
            "city",
            "certification",
            "name",
            "issueDateMonthText",
            "issueDateYear",
            "reference",
            "reasonLeaving",
            "supervisor"
          ]
        },
        {
          "title": [
            "Diversity",
            "Diversity Continued",
            "Self Identification",
            "Voluntary Self",
            "Self ID",
            "Disability Survey"
          ],
          "entities": [
            "disability",
            "fullName",
            "applyDate",
            "gender",
            "veteran",
            "race"
          ]
        },
        {
          "title": [
            "eSignature",
            "Signature",
            "Acknowledge"
          ],
          "entities": [
            "fullName",
            "email"
          ]
        },
        {
          "title": [
            "Reference"
          ],
          "entities": [
            "reference"
          ]
        },
        {
          "title": [
            "Questionnaire"
          ],
          "entities": [
            "answerSource",
            "diversity",
            "applyDate"
          ]
        },
        {
          "title": [
            "Questions",
            "Employment Eligibility"
          ],
          "entities": [
            "sponsorship"
          ]
        },
        {
          "title": [
            "Disclosure",
            "Agreement"
          ],
          "entities": [
            "privacyAgreement"
          ]
        },
        {
          "title": [
            "Specific",
            "Submit",
            "Profile Questions",
            "Job Opportunity",
            "Employment Application",
            "Additional Information",
            "Prescreening",
            "Profile"
          ],
          "entities": [
            ""
          ]
        }
      ]
    },
    "entities": [
      [
        "applyBtn",
        {
          "actions": [
            {
              "key": "canJobBeAppliedXPaths.applyButton",
              "method": "click"
            }
          ]
        }
      ],
      [
        "privacyAgreement",
        {
          "actions": [
            {
              "path": [
                "//input[contains(@value, 'I Accept')]",
                "//input[contains(@name, 'StatementBeforeAuthentification') and contains(@onclick, 'ContinueButton')]",
                "//input[contains(@value, 'I have read')]",
                "//input[@value='OK']"
              ],
              "method": "click"
            },
            {
              "path": [
                "//label[CONTAINS_TEXT('i want') and contains(@for, 'Upload') and contains(@for, 'Resume')]//input[@type='radio' and not(@checked)]",
                "//input[contains(@name, 'ResumeParsing') and not(@checked) and not(contains(@name, 'skipResumeUpload')) and @type != 'file' and not(contains(@name, 'UploadResumeBlock'))]"
              ],
              "method": "click"
            }
          ]
        }
      ],
      [
        "email",
        [
          ".//input[contains(@id, 'candidate_personal_info_EmailAddress')]",
          ".//input[contains(@id, 'esignature_UniqueSignature')]"
        ]
      ],
      [
        "firstName",
        [
          ".//input[contains(@id, 'candidate_personal_info_FirstName')]"
        ]
      ],
      [
        "lastName",
        [
          "//input[contains(@id, 'candidate_personal_info_LastName')]"
        ]
      ],
      [
        "preferredFirstName",
        [
          ".//input[contains(@id, 'PreferredName')]"
        ]
      ],
      [
        "street",
        [
          "//input[contains(@id, 'candidate_personal_info_Address')]"
        ]
      ],
      [
        "cityLocated",
        [
          "//input[contains(@id, 'candidate_personal_info_City')]"
        ]
      ],
      [
        "addressLine1",
        [
          "//input[contains(@id, 'candidate_personal_info_Address')]"
        ]
      ],
      [
        "birthDate",
        {
          "actions": [
            {
              "method": "setDateInput",
              "format": "MM/dd/yyyy",
              "fullDate": {
                "path": [
                  "//input[contains(@id, 'candidate_personal_info_Birthday.inputrelevant')]"
                ],
                "format": "yyyy-MM-dd"
              }
            }
          ]
        }
      ],
      [
        "phoneType",
        {
          "actions": [
            {
              "path": [
                "//select[contains(@id, 'PreferredPhone')]"
              ],
              "method": "clickOption",
              "values": {
                "mobile": [
                  "Cellular Phone"
                ]
              }
            }
          ]
        }
      ],
      [
        "phoneFormatted",
        [
          {
            "actions": [
              {
                "path": [
                  ".//input[contains(@id, 'candidate_personal_info_MobilePhone')][not(../following-sibling::span[contains(translate(.,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'enter without dashes')])]"
                ],
                "method": "setValue"
              }
            ]
          },
          {
            "actions": [
              {
                "path": [
                  ".//input[contains(@id, 'CandidatePersonalInfo_Text_Message_Phone_number')]"
                ],
                "method": "setValue"
              }
            ]
          }
        ]
      ],
      [
        "phoneStripped",
        {
          "actions": [
            {
              "path": [
                "//input[contains(@id,'candidate_personal_info_MobilePhone')][../following-sibling::span[contains(translate(.,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'enter without dashes')]]"
              ],
              "method": "setValue",
              "options": {
                "resetValue": true
              }
            }
          ]
        }
      ],
      [
        "homePhoneFormatted",
        [
          "//input[contains(@id,'candidate_personal_info_HomePhone')][not(../following-sibling::span[contains(translate(.,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'enter without dashes')])]"
        ]
      ],
      [
        "homePhoneStripped",
        {
          "actions": [
            {
              "path": [
                "//input[contains(@id,'candidate_personal_info_HomePhone')][../following-sibling::span[contains(translate(.,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'enter without dashes')]]"
              ],
              "method": "setValue",
              "options": {
                "resetValue": true
              }
            }
          ]
        }
      ],
      [
        "workPhoneFormatted",
        [
          "//input[contains(@id, 'candidate_personal_info_WorkPhone')]"
        ]
      ],
      [
        "phoneCode",
        [
          {
            "actions": [
              {
                "path": [
                  ".//div[@data-automation-id='formField-country-phone-code']//input"
                ],
                "method": "setValue"
              }
            ]
          },
          {
            "actions": [
              {
                "path": [
                  ".//input[contains(@id, 'candidate_personal_info_UDFCandidatePersonalInfo_WC_Country_Phone') and @type='text']"
                ],
                "method": "setValue",
                "defaultValue": "United States"
              }
            ]
          }
        ]
      ],
      [
        "county",
        {
          "actions": [
            {
              "path": [
                "//input[contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'candidatepersonalinfo_county')]"
              ],
              "method": "getCounty"
            },
            {
              "path": [
                "//input[contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'candidatepersonalinfo_county')]"
              ],
              "method": "setValue",
              "options": {
                "waitForNetworkBeforeInteraction": true
              }
            }
          ]
        }
      ],
      [
        "country",
        {
          "actions": [
            {
              "path": [
                "//select[contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'residencelocation-0')]"
              ],
              "method": "clickOption",
              "values": {
                "United States": [
                  "United States"
                ]
              }
            }
          ]
        }
      ],
      [
        "stateName",
        {
          "actions": [
            {
              "path": [
                "//select[contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'residencelocation-1')]"
              ],
              "method": "clickOption",
              "time": 1000
            }
          ]
        }
      ],
      [
        "state",
        [
          {
            "actions": [
              {
                "path": [
                  ".//select[contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'state')]"
                ],
                "method": "clickOption",
                "options": {
                  "fallbackToOptionIndex": 1
                }
              }
            ]
          },
          {
            "actions": [
              {
                "path": [
                  ".//input[contains(@id,  'CAND_STATE')]"
                ],
                "method": "setValue"
              }
            ]
          }
        ]
      ],
      [
        "city",
        {
          "actions": [
            {
              "path": [
                "//select[contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'residencelocation-2')]"
              ],
              "method": "clickOption",
              "time": 1000,
              "options": {
                "fallbackToOptionIndex": 1
              }
            }
          ]
        }
      ],
      [
        "postalCode",
        [
          "//input[contains(@id, 'candidate_personal_info_ZipCode')]"
        ]
      ],
      [
        "education",
        {
          "addButtonPath": [
            "//a[contains(@id, 'AddEducation')]"
          ],
          "confirmAddedPath": [
            ""
          ],
          "containerPath": [
            "//div[contains(@id, 'csef-efi-__indexString__-frm')]"
          ],
          "entities": [
            [
              "name",
              [
                {
                  "actions": [
                    {
                      "path": [
                        ".//input[contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'institution')]"
                      ],
                      "method": "setValue",
                      "options": {
                        "resetValue": true
                      }
                    }
                  ]
                },
                {
                  "actions": [
                    {
                      "path": [
                        ".//input[contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'education_institution') and (@type='text')]"
                      ],
                      "method": "click"
                    },
                    {
                      "path": [
                        ".//input[contains(translate(@name, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'education_institution') and (@type='text')]"
                      ],
                      "method": "setValue",
                      "options": {
                        "resetValue": true,
                        "triggerKeyDownEvent": true,
                        "separatorCharacter": ", ",
                        "fixSearchTrigger": 1,
                        "waitForNetworkAfterInteraction": true
                      },
                      "time": 1000
                    },
                    {
                      "path": [
                        ".//div[contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'education_institution-list')][__indexPlusOne__]"
                      ],
                      "method": "clickOptionAsync",
                      "options": {
                        "separatorCharacter": ", ",
                        "similarMatch": true,
                        "stopVariantsGeneration": true,
                        "containerElement": "document",
                        "waitForNetworkBeforeInteraction": true
                      }
                    }
                  ]
                }
              ]
            ],
            [
              "degree",
              {
                "actions": [
                  {
                    "path": [
                      ".//select[contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'studylevel')]",
                      ".//select[contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'education') and contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'level')]"
                    ],
                    "method": "clickOption",
                    "values": {
                      "bachelor's": [
                        "Bachelor's Degree",
                        "Bachelors"
                      ],
                      "master's": [
                        "Master's Degree",
                        "Master of Science",
                        "Masters"
                      ],
                      "associate's": [
                        "Associate's Degree"
                      ]
                    },
                    "options": {
                      "preserveSpecialChars": true
                    }
                  }
                ]
              }
            ],
            [
              "major",
              {
                "actions": [
                  {
                    "path": [
                      ".//input[contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'program')]"
                    ],
                    "method": "setValue",
                    "options": {
                      "resetValue": true,
                      "fixSearchTrigger": 1,
                      "triggerKeyDownEvent": true,
                      "waitForNetworkAfterInteraction": true
                    },
                    "time": 1000
                  },
                  {
                    "path": [
                      ".//div[contains(@id, 'education_Program-list')][__indexPlusOne__][contains(@style, 'visibility: visible')]"
                    ],
                    "method": "clickOptionAsync",
                    "options": {
                      "similarMatch": true,
                      "stopVariantsGeneration": true,
                      "containerElement": "document"
                    }
                  }
                ]
              }
            ],
            [
              "country",
              {
                "actions": [
                  {
                    "path": [
                      ".//select[contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'location-0')]"
                    ],
                    "method": "clickOption",
                    "time": 1000
                  }
                ]
              }
            ],
            [
              "stateName",
              {
                "actions": [
                  {
                    "path": [
                      ".//select[contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'location-1')]"
                    ],
                    "method": "clickOption",
                    "time": 1000
                  }
                ]
              }
            ],
            [
              "city",
              [
                {
                  "actions": [
                    {
                      "path": [
                        ".//select[contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'location-2')]"
                      ],
                      "method": "clickOption",
                      "options": {
                        "fallbackToOptionIndex": 1
                      }
                    }
                  ]
                },
                {
                  "actions": [
                    {
                      "path": [
                        ".//input[contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'city')]"
                      ],
                      "method": "setValue"
                    }
                  ]
                }
              ]
            ],
            [
              "isGraduated",
              {
                "actions": [
                  {
                    "path": [
                      ".//select[contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'graduate')]",
                      ".//select[contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'degree') and contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'completion') ]",
                      ".//select[contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'efi-__index__') and contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'edustatus') ]"
                    ],
                    "method": "clickOption",
                    "values": {
                      "true": [
                        "yes",
                        "completed",
                        "graduated",
                        "completed/graduated"
                      ],
                      "false": [
                        "currently pursuing",
                        "no",
                        "not completed"
                      ]
                    }
                  }
                ]
              }
            ],
            [
              "studentName",
              [
                ".//input[contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'nameattending')]"
              ]
            ],
            [
              "startDateMonthText",
              {
                "actions": [
                  {
                    "path": [
                      ".//select[contains(@id, 'education_startDate.month')]"
                    ],
                    "method": "clickOption",
                    "values": {
                      "January": [
                        "Jan",
                        "January",
                        "01"
                      ],
                      "February": [
                        "Feb",
                        "February",
                        "02"
                      ],
                      "March": [
                        "Mar",
                        "March",
                        "03"
                      ],
                      "April": [
                        "Apr",
                        "April",
                        "04"
                      ],
                      "May": [
                        "May",
                        "05"
                      ],
                      "June": [
                        "Jun",
                        "June",
                        "06"
                      ],
                      "July": [
                        "Jul",
                        "July",
                        "07"
                      ],
                      "August": [
                        "Aug",
                        "August",
                        "08"
                      ],
                      "September": [
                        "Sep",
                        "September",
                        "09"
                      ],
                      "October": [
                        "Oct",
                        "October",
                        "10"
                      ],
                      "November": [
                        "Nov",
                        "November",
                        "11"
                      ],
                      "December": [
                        "Dec",
                        "December",
                        "12"
                      ]
                    }
                  }
                ]
              }
            ],
            [
              "startDateYear",
              {
                "actions": [
                  {
                    "path": [
                      ".//select[contains(@id, 'education_startDate.year')]"
                    ],
                    "method": "clickOption"
                  }
                ]
              }
            ],
            [
              "endDateMonthText",
              {
                "actions": [
                  {
                    "path": [
                      ".//select[contains(@id, 'education_graduationDate.month')]"
                    ],
                    "method": "clickOption",
                    "values": {
                      "January": [
                        "Jan",
                        "January",
                        "01"
                      ],
                      "February": [
                        "Feb",
                        "February",
                        "02"
                      ],
                      "March": [
                        "Mar",
                        "March",
                        "03"
                      ],
                      "April": [
                        "Apr",
                        "April",
                        "04"
                      ],
                      "May": [
                        "May",
                        "05"
                      ],
                      "June": [
                        "Jun",
                        "June",
                        "06"
                      ],
                      "July": [
                        "Jul",
                        "July",
                        "07"
                      ],
                      "August": [
                        "Aug",
                        "August",
                        "08"
                      ],
                      "September": [
                        "Sep",
                        "September",
                        "09"
                      ],
                      "October": [
                        "Oct",
                        "October",
                        "10"
                      ],
                      "November": [
                        "Nov",
                        "November",
                        "11"
                      ],
                      "December": [
                        "Dec",
                        "December",
                        "12"
                      ]
                    }
                  }
                ]
              }
            ],
            [
              "endDateYear",
              {
                "actions": [
                  {
                    "path": [
                      ".//select[contains(@id, 'education_graduationDate.year')]"
                    ],
                    "method": "clickOption"
                  }
                ]
              }
            ],
            [
              "gpa",
              [
                ".//input[contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'gpa')]"
              ]
            ],
            [
              "antecipatedGraduationDate",
              {
                "actions": [
                  {
                    "path": [
                      ".//input[contains(@id, 'graduationDateProjected') and @type='checkbox']"
                    ],
                    "method": "clickCheckbox"
                  }
                ]
              }
            ]
          ]
        }
      ],
      [
        "experience",
        {
          "addButtonPath": [
            "//a[contains(@id, 'AddWorkExperience')]"
          ],
          "confirmAddedPath": [
            ""
          ],
          "containerPath": [
            "//div[contains(@id, 'we-wei-__indexString__-frm')]",
            "//table[contains(@id, 'we-wei-__indexString__-frm')]"
          ],
          "entities": [
            [
              "companyName",
              {
                "actions": [
                  {
                    "path": [
                      ".//input[contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'employer') and @type='text']"
                    ],
                    "method": "setValue"
                  }
                ]
              }
            ],
            [
              "title",
              {
                "actions": [
                  {
                    "path": [
                      ".//input[contains(@id, 'JobFunction') or contains(@id, 'WORK_POSN_TITLE')]",
                      ".//input[contains(@id, '_JobTitle')]",
                      ".//input[contains(@id, 'Experience_ES2')]"
                    ],
                    "method": "setValue"
                  }
                ]
              }
            ],
            [
              "city",
              {
                "actions": [
                  {
                    "path": [
                      ".//input[contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'experience_city')]",
                      ".//input[contains(@id, 'Experience_EmployerCity')]",
                      ".//input[contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'experience_bll_city')]",
                      ".//input[contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'city') and @type='text']"
                    ],
                    "method": "setValue"
                  }
                ]
              }
            ],
            [
              "stateName",
              {
                "actions": [
                  {
                    "path": [
                      ".//input[contains(@id, 'experience_UDFExperience_EmployerState')]"
                    ],
                    "method": "setValue"
                  },
                  {
                    "path": [
                      ".//select[contains(@id, 'STATE')]"
                    ],
                    "method": "clickOption",
                    "time": 1000
                  }
                ]
              }
            ],
            [
              "description",
              {
                "actions": [
                  {
                    "path": [
                      ".//textArea[contains(@id, 'experience_Responsibility')]",
                      ".//input[contains(@id, 'Job_Duties')]",
                      ".//textArea[contains(@id, 'Experience_BLL_Duties')]",
                      ".//input[contains(@id, 'Experience_DescriptionofDuties')]"
                    ],
                    "method": "setValue"
                  }
                ]
              }
            ],
            [
              "state",
              {
                "actions": [
                  {
                    "path": [
                      ".//input[contains(@id, 'Experience_EmployerState')]",
                      ".//input[contains(@id, 'Experience_State')]"
                    ],
                    "method": "setValue"
                  }
                ]
              }
            ],
            [
              "startDateDashes_YYYYMMDD",
              {
                "actions": [
                  {
                    "path": [
                      ".//input[contains(@id, 'experience_BeginDate.inputrelevant')]"
                    ],
                    "method": "setValue"
                  }
                ]
              }
            ],
            [
              "endDateDashes_YYYYMMDD",
              {
                "actions": [
                  {
                    "path": [
                      ".//input[contains(@id, 'experience_EndDate.inputrelevant')]"
                    ],
                    "method": "setValue"
                  }
                ]
              }
            ],
            [
              "startDateMonthText",
              {
                "actions": [
                  {
                    "path": [
                      ".//select[contains(@id, 'experience_BeginDate.month')]"
                    ],
                    "method": "clickOption",
                    "values": {
                      "January": [
                        "Jan",
                        "January",
                        "01"
                      ],
                      "February": [
                        "Feb",
                        "February",
                        "02"
                      ],
                      "March": [
                        "Mar",
                        "March",
                        "03"
                      ],
                      "April": [
                        "Apr",
                        "April",
                        "04"
                      ],
                      "May": [
                        "May",
                        "05"
                      ],
                      "June": [
                        "Jun",
                        "June",
                        "06"
                      ],
                      "July": [
                        "Jul",
                        "July",
                        "07"
                      ],
                      "August": [
                        "Aug",
                        "August",
                        "08"
                      ],
                      "September": [
                        "Sep",
                        "September",
                        "09"
                      ],
                      "October": [
                        "Oct",
                        "October",
                        "10"
                      ],
                      "November": [
                        "Nov",
                        "November",
                        "11"
                      ],
                      "December": [
                        "Dec",
                        "December",
                        "12"
                      ]
                    }
                  }
                ]
              }
            ],
            [
              "startDateYear",
              {
                "actions": [
                  {
                    "path": [
                      ".//select[contains(@id, 'experience_BeginDate.year')]"
                    ],
                    "method": "clickOption"
                  }
                ]
              }
            ],
            [
              "endDateMonthText",
              {
                "actions": [
                  {
                    "path": [
                      ".//select[contains(@id, 'experience_EndDate.month')]"
                    ],
                    "method": "clickOption",
                    "values": {
                      "January": [
                        "Jan",
                        "January",
                        "01"
                      ],
                      "February": [
                        "Feb",
                        "February",
                        "02"
                      ],
                      "March": [
                        "Mar",
                        "March",
                        "03"
                      ],
                      "April": [
                        "Apr",
                        "April",
                        "04"
                      ],
                      "May": [
                        "May",
                        "05"
                      ],
                      "June": [
                        "Jun",
                        "June",
                        "06"
                      ],
                      "July": [
                        "Jul",
                        "July",
                        "07"
                      ],
                      "August": [
                        "Aug",
                        "August",
                        "08"
                      ],
                      "September": [
                        "Sep",
                        "September",
                        "09"
                      ],
                      "October": [
                        "Oct",
                        "October",
                        "10"
                      ],
                      "November": [
                        "Nov",
                        "November",
                        "11"
                      ],
                      "December": [
                        "Dec",
                        "December",
                        "12"
                      ]
                    }
                  }
                ]
              }
            ],
            [
              "endDateYear",
              {
                "actions": [
                  {
                    "path": [
                      ".//select[contains(@id, 'experience_EndDate.year')]"
                    ],
                    "method": "clickOption"
                  }
                ]
              }
            ],
            [
              "isCurrent",
              {
                "actions": [
                  {
                    "path": [
                      ".//input[contains(@id, 'experience_CurrentEmployer') and @type='checkbox']"
                    ],
                    "method": "clickCheckbox"
                  }
                ]
              }
            ],
            [
              "country",
              [
                {
                  "actions": [
                    {
                      "path": [
                        ".//select[contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'experience_country')]"
                      ],
                      "method": "clickOption"
                    }
                  ]
                },
                {
                  "actions": [
                    {
                      "path": [
                        ".//input[contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'experience_country')]",
                        ".//input[contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'experience_bll_country')]"
                      ],
                      "method": "setValue"
                    }
                  ]
                }
              ]
            ],
            [
              "stateName",
              {
                "actions": [
                  {
                    "path": [
                      ".//input[contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'experience_bll_state')]"
                    ],
                    "method": "setValue"
                  },
                  {
                    "path": [
                      ".//select[contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'experience_state')]"
                    ],
                    "method": "clickOption",
                    "time": 1000
                  }
                ]
              }
            ],
            [
              "supervisor",
              {
                "actions": [
                  {
                    "path": [
                      ".//input[contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '_supervisor')][@id=//label[contains(translate(@title, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'mandatory')]/@for]"
                    ],
                    "method": "setValueMultiple"
                  }
                ]
              }
            ],
            [
              "reasonLeaving",
              {
                "actions": [
                  {
                    "path": [
                      ".//input[contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'reason_leaving') and @size='25' and @id=//label[contains(translate(@title, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'mandatory')]/@for]"
                    ],
                    "method": "setValue"
                  }
                ]
              }
            ]
          ]
        }
      ],
      [
        "reference",
        {
          "actions": [
            {
              "path": [
                ".//input[contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '_reference_') and not(contains(@id, 'phoneNumber')) and @id=//label[contains(translate(@title, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'mandatory')]/@for]"
              ],
              "method": "setValueMultiple"
            }
          ]
        }
      ],
      [
        "certification",
        {
          "addButtonPath": [
            "//a[contains(@id, 'CertificationForm-cmdAdd')]"
          ],
          "confirmAddedPath": [
            ""
          ],
          "containerPath": [
            "//table[contains(@id, 'certificationFragmentIter-__indexString__-j_id')]",
            "//span[contains(@id, 'certificationFragmentIter-__indexString__-j_id')]"
          ],
          "entities": [
            [
              "name",
              {
                "actions": [
                  {
                    "path": [
                      ".//input[contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'certification_certification')]"
                    ],
                    "method": "setValue"
                  }
                ]
              }
            ],
            [
              "issueDateMonthText",
              {
                "actions": [
                  {
                    "path": [
                      ".//select[contains(@id, 'certification_dateReceived.month')]"
                    ],
                    "method": "clickOption",
                    "values": {
                      "January": [
                        "Jan",
                        "January",
                        "01"
                      ],
                      "February": [
                        "Feb",
                        "February",
                        "02"
                      ],
                      "March": [
                        "Mar",
                        "March",
                        "03"
                      ],
                      "April": [
                        "Apr",
                        "April",
                        "04"
                      ],
                      "May": [
                        "May",
                        "05"
                      ],
                      "June": [
                        "Jun",
                        "June",
                        "06"
                      ],
                      "July": [
                        "Jul",
                        "July",
                        "07"
                      ],
                      "August": [
                        "Aug",
                        "August",
                        "08"
                      ],
                      "September": [
                        "Sep",
                        "September",
                        "09"
                      ],
                      "October": [
                        "Oct",
                        "October",
                        "10"
                      ],
                      "November": [
                        "Nov",
                        "November",
                        "11"
                      ],
                      "December": [
                        "Dec",
                        "December",
                        "12"
                      ]
                    }
                  }
                ]
              }
            ],
            [
              "issueDateYear",
              {
                "actions": [
                  {
                    "path": [
                      ".//select[contains(@id, 'certification_dateReceived.year')]"
                    ],
                    "method": "clickOption"
                  }
                ]
              }
            ]
          ]
        }
      ],
      [
        "resume",
        {
          "actions": [
            {
              "path": [
                "//input[contains(@id, 'resumeUploadRadio') and @type='radio' and not(@checked)]"
              ],
              "method": "click"
            },
            {
              "path": [
                "//input[contains(@id, 'resumeUploadRadio') and @type='file']",
                "//input[contains(@id, 'AttachedFilesBlock-uploadedFile') and @type='file']",
                "//input[contains(@id, 'ResumeUploadInputFile') and @type='file']"
              ],
              "method": "uploadResume"
            },
            {
              "path": [
                "//input[contains(@id, 'attachFileCommand')]"
              ],
              "method": "clickConfirmAttachment",
              "time": 1000
            },
            {
              "path": [
                "//input[@type='checkbox' and not(@checked) and contains(@title, 'Select the file')]"
              ],
              "method": "click"
            },
            {
              "path": [
                "//input[contains(@id, 'resumeselectionid')]"
              ],
              "method": "clickCheckbox",
              "options": {
                "check": true
              }
            }
          ]
        }
      ],
      [
        "referral",
        {
          "actions": [
            {
              "path": [
                "//input[contains(@id, 'referralSource')]"
              ],
              "method": "clickOption",
              "values": {
                "true": [
                  "Yes"
                ],
                "false": [
                  "No"
                ]
              }
            }
          ]
        }
      ],
      [
        "over18",
        {
          "actions": [
            {
              "path": [
                "//fieldset[contains(., '18 years') and not(.//select[contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'studylevel')])]"
              ],
              "method": "clickOption",
              "values": {
                "true": [
                  "Yes"
                ],
                "false": [
                  "No"
                ]
              }
            }
          ]
        }
      ],
      [
        "sponsorship",
        {
          "actions": [
            {
              "path": [
                "//fieldset[contains(., 'sponsorship')]//select"
              ],
              "method": "clickOption",
              "values": {
                "true": [
                  "Yes"
                ],
                "false": [
                  "No"
                ]
              }
            }
          ]
        }
      ],
      [
        "answerSource",
        [
          {
            "actions": [
              {
                "path": [
                  "//input[contains(@id, 'recruitmentSourceType')]"
                ],
                "method": "clickOption",
                "defaultValue": "Internet",
                "options": {
                  "waitForNetworkAfterInteraction": true
                }
              }
            ]
          },
          {
            "actions": [
              {
                "path": [
                  "//input[@id='recruitmentSourceDP']",
                  "//select[@id='recruitmentSourceDP']",
                  "//select[contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'sourcetype')]",
                  "//input[contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'sourcetype')]"
                ],
                "method": "clickOptionWithMultiAnswers",
                "values": {
                  "source": [
                    "Internet",
                    "Other",
                    "Google",
                    "Job board"
                  ]
                },
                "options": {
                  "lowPriority": [
                    "Indeed",
                    "ZipRecruiter",
                    "LinkedIn",
                    "Glassdoor",
                    "Simplyhired",
                    "Dice",
                    "CareerBuilder",
                    "Monster"
                  ],
                  "prohibited": [
                    "referral",
                    "referred",
                    "connection",
                    "at the company",
                    "for the organization",
                    "employee",
                    "select",
                    "current worker"
                  ],
                  "ignoreFirst": true,
                  "waitForNetworkBeforeInteraction": true,
                  "waitForNetworkAfterInteraction": true,
                  "selectFirstExcludingProhibited": true,
                  "fallbackToOptionIndex": 1
                },
                "time": 600
              },
              {
                "path": [
                  "//select[@id='recruitmentSourceDP']"
                ],
                "method": "clickOption",
                "values": {
                  "source": [
                    "Internet",
                    "Other",
                    "Google",
                    "Google Search"
                  ]
                },
                "options": {
                  "lowPriority": [
                    "Indeed",
                    "ZipRecruiter",
                    "LinkedIn",
                    "Glassdoor",
                    "Simplyhired",
                    "Dice",
                    "CareerBuilder",
                    "Monster"
                  ],
                  "prohibited": [
                    "referral",
                    "referred",
                    "connection",
                    "at the company",
                    "for the organization",
                    "employee",
                    "select",
                    "current worker"
                  ],
                  "ignoreFirst": true,
                  "waitForNetworkBeforeInteraction": true,
                  "selectFirstExcludingProhibited": true,
                  "fallbackToOptionIndex": 1
                }
              },
              {
                "path": [
                  "//textarea[contains(@id, 'recruitmentSourceDetail')]",
                  "//input[contains(@id, 'recruitmentSourceDetail')]"
                ],
                "method": "setValue",
                "defaultValue": "Job Board"
              }
            ]
          }
        ]
      ],
      [
        "disability",
        {
          "actions": [
            {
              "path": [
                "//div[@class='text-style'][div/input[@type='checkbox' and (@aria-label='Yes, I have a disability, or have had one in the past' or @aria-label='No, I do not have a disability and have not had one in the past' or @aria-label='I do not want to answer')]]",
                "//div[@class='fields'][input[@type='checkbox' and (@aria-label='Yes, I Have A Disability, Or Have A History/Record Of Having A Disability' or contains(translate(@aria-label, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'no, i don') or contains(translate(@aria-label, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'wish to answer'))]]",
                "//select[contains(@id, 'UDFCandidatePersonalInfo_Disability')]"
              ],
              "method": "clickOption",
              "options": {
                "optionMatchAttribute": [
                  "aria-label"
                ],
                "forceSearchForFrameContainer": true
              },
              "values": {
                "true": [
                  "Yes ",
                  "Yes,",
                  "Yes",
                  "Yes, I have",
                  "I have"
                ],
                "false": [
                  "No ",
                  "No,",
                  "No",
                  "I do not have",
                  "Prefer not",
                  "No, I Don't"
                ],
                "": [
                  "Decline",
                  "No ",
                  "No",
                  "I don't wish",
                  "Prefer not"
                ]
              }
            }
          ]
        }
      ],
      [
        "gender",
        {
          "actions": [
            {
              "path": [
                ".//select[contains(@id, 'diversityBlock') and contains(translate(@title, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'gender')]"
              ],
              "method": "clickOption",
              "values": {
                "Male": [
                  "Male",
                  "Man"
                ],
                "Female": [
                  "Female",
                  "Woman"
                ],
                "I do not want to answer": [
                  "Decline",
                  "I don't wish",
                  "Prefer not"
                ],
                "": [
                  "Decline",
                  "I don't wish",
                  "Prefer not"
                ]
              }
            }
          ]
        }
      ],
      [
        "veteran",
        {
          "actions": [
            {
              "path": [
                ".//select[contains(@id, 'diversityBlock') and contains(translate(@title, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'veteran')]"
              ],
              "method": "clickOption",
              "values": {
                "true": [
                  "I am a ",
                  "I identify ",
                  "Yes"
                ],
                "false": [
                  "I am not a ",
                  "I don't ",
                  "No",
                  "Prefer not"
                ],
                "": [
                  "Decline",
                  "I am not a ",
                  "I don't ",
                  "No",
                  "Prefer not"
                ]
              }
            }
          ]
        }
      ],
      [
        "race",
        {
          "actions": [
            {
              "path": [
                ".//select[contains(@id, 'diversityBlock') and contains(translate(@title, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'race')]"
              ],
              "method": "clickOption",
              "values": {
                "Black or African American": [
                  "Black",
                  "African"
                ],
                "East Asian": [
                  "East Asian",
                  "Asian"
                ],
                "Hispanic or Latino": "Hispanic",
                "Southeast Asian": [
                  "Southeast Asian",
                  "Asian"
                ],
                "South Asian": [
                  "South Asian",
                  "Asian"
                ],
                "Native Hawaiian or Other Pacific Islander": [
                  "Native Hawaiian",
                  "Pacific Islander"
                ],
                "American Indian or Alaska Native": [
                  "American Indian",
                  "Alaskan Native"
                ],
                "White": "White",
                "Two or More Races": "Two or More",
                "Some Other Race": [
                  "Other",
                  "Decline"
                ],
                "Decline to Answer": [
                  "Decline",
                  "Prefer not"
                ],
                "": [
                  "Decline"
                ]
              }
            }
          ]
        }
      ],
      [
        "fullName",
        {
          "actions": [
            {
              "path": [
                ".//input[contains(translate(@aria-label, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'name') and @type='text']",
                "//input[contains(@id, 'esignature_FullName') and @type='text']"
              ],
              "method": "setValue",
              "options": {
                "forceSearchForFrameContainer": true
              }
            }
          ]
        }
      ],
      [
        "applyDate",
        {
          "actions": [
            {
              "path": [
                ".//input[contains(translate(@aria-label, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'date') and @type='text']",
                "//a[contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'disability_date.display')]",
                ".//a[contains(@class,  'input-date-time-text')]"
              ],
              "method": "click",
              "options": {
                "forceSearchForFrameContainer": true
              }
            },
            {
              "path": [
                ".//input[contains(translate(@aria-label, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'date') and @type='text']",
                ".//input[contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'disability_date')]"
              ],
              "method": "setValue",
              "options": {
                "forceSearchForFrameContainer": true
              }
            },
            {
              "path": [
                "//td[contains(@class, 'ui-datepicker-today')]",
                "//div[contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'disability_date-maindiv')]//td[contains(@class, 'day selected')]",
                "//table[contains(@id, 'Date-table')]//td[contains(@class, 'today')]"
              ],
              "method": "click",
              "options": {
                "forceSearchForFrameContainer": true
              }
            },
            {
              "path": ".//input[contains(translate(@aria-label, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'date') and @type='text']",
              "method": "click",
              "options": {
                "forceSearchForFrameContainer": true,
                "clickOutsideAtEnd": true
              }
            }
          ]
        }
      ],
      [
        "minYearlySalaryDesired",
        [
          ".//input[contains(@id, 'PersonalInfo_Salary') and @type='text']"
        ]
      ],
      [
        "birthMonth",
        {
          "actions": [
            {
              "path": [
                ".//select[contains(@name, 'Birthday.month')]"
              ],
              "method": "clickOption"
            }
          ]
        }
      ],
      [
        "birthDay",
        {
          "actions": [
            {
              "path": [
                ".//select[contains(@name, 'Birthday.day')]"
              ],
              "method": "clickOption"
            }
          ]
        }
      ],
      [
        "birthYear",
        {
          "actions": [
            {
              "path": [
                ".//select[contains(@name, 'Birthday.year')]"
              ],
              "method": "clickOption"
            }
          ]
        }
      ],
      [
        "workStartDateAvailabilityString",
        {
          "actions": [
            {
              "path": [
                "//fieldset[contains(.//label, 'When would you be available to begin')]//textarea"
              ],
              "method": "setValue"
            }
          ]
        }
      ]
    ]
  },
  "workable": {
    "atsName": "workable",
    "urls": [
      "*://*.workable.com/*/j/*/apply/*",
      "*://*.workable.com/view/*",
      "*://*.workable.com/search?*selectedJobId"
    ],
    "detectPageQuestions": true,
    "submitButtonPaths": [
      ".//button[@data-ui='apply-button' and @type='submit']"
    ],
    "textContentFallbacks": [
      "SVGs not supported by this browser."
    ],
    "validationCheckFormValidity": true,
    "waitForSubmitOutcome": true,
    "backStepButtonPaths": [],
    "backStepDiscardButtonPaths": [],
    "validationErrorXPaths": [
      ".//dialog[@role='alert']",
      ".//span[contains(@id, '_error')]"
    ],
    "captchaXpath": [
      ".//div[contains(@id, 'turnstile-container')]/*"
    ],
    "networkOptions": {
      "blacklistedUrlParts": [
        "linkedin",
        "analytics",
        "insights",
        "collect"
      ]
    },
    "pageFailureKeywords": [],
    "errorBannerXPaths": [],
    "confirmSubmittedForm": {
      "confirmMessageXPath": [
        ".//div[@data-ui='successful-submit']",
        ".//h3[@data-ui='application-form-success-subtitle']"
      ],
      "urls": [
        "*://*.workable.com/*/j/*/apply/?success",
        "*://*.workable.com/view/*"
      ],
      "confirmMessageSelector": "[data-ui='successful-submit'], [data-ui='application-form-success-subtitle']"
    },
    "questionValidationErrorSelectors": [
      "dialog[role='alert']",
      "span[id*='_error']"
    ],
    "targetNodeXPath": [
      ".//main[@role='main']",
      "//body"
    ],
    "expiredJob": [
      {
        "container": [
          ".//h1",
          ".//h2"
        ],
        "keywords": [
          "job openings"
        ]
      }
    ],
    "forceNewJobSearch": true,
    "canJobBeAppliedXPaths": {
      "applyButton": []
    },
    "formatElements": "",
    "customQuestions": {
      "patterns": {
        "questionId": "",
        "questionParent": ""
      },
      "selectors": {
        "question": "fieldset[role='radiogroup'][aria-labelledby], div[role='group'][aria-labelledby], input[type='text']:not([aria-hidden]), textarea[id]:not([aria-hidden])",
        "subTitle": "h2",
        "label": "label",
        "legend": "legend",
        "ariaLabelledBy": "[aria-labelledby*=__labelId__]",
        "roleOption": "li[role='option']",
        "radioInput": "input[type='radio']",
        "checkbox": "input[type='checkbox']",
        "questionParent": "",
        "mapOption": "",
        "selectPopup": "ul[role='listbox'][id='__controls__']"
      },
      "xpaths": {
        "currentListItem": [],
        "listInputBackBtnText": [],
        "selectPopupXPath": [],
        "listBoxPopupXPath": [],
        "selectedItemListXPath": [],
        "requiredFieldXPath": [
          "//strong[contains(text(), '*')]"
        ]
      },
      "ignoreQuestions": []
    },
    "jobXPaths": {
      "entities": [
        [
          "titleDisplay",
          [
            ".//h1[@data-ui='job-title']"
          ]
        ],
        [
          "originalCompanyName",
          [
            "//a[@data-ui='company-logo']/img/@alt",
            "//a[@data-ui='company-logo']/span"
          ]
        ],
        [
          "jobTypes",
          [
            ".//span[@data-ui='job-type']"
          ]
        ],
        [
          "url",
          [
            ".//meta[@property='og:url']/@content"
          ]
        ],
        [
          "desc",
          [
            ".//section[@data-ui='job-description']"
          ]
        ],
        [
          "locationDisplay",
          [
            "//div[@data-ui='job-location']"
          ]
        ]
      ]
    },
    "preApply": {
      "urls": [
        "*://*.workable.com/*/j/*",
        "*://*.workable.com/view/*",
        "*://*.workable.com/search?*selectedJobId"
      ],
      "entities": [
        [
          "cookieConsent",
          {
            "actions": [
              {
                "path": [
                  "//button[@data-ui='cookie-consent-decline']"
                ],
                "method": "click",
                "time": 250
              }
            ]
          },
          {
            "keywords": [
              "cookie settings"
            ]
          }
        ],
        [
          "applyButton",
          {
            "actions": [
              {
                "path": [
                  ".//a[@data-ui='apply-button']"
                ],
                "method": "click"
              },
              {
                "path": [
                  ".//button[@data-ui='overview-apply-now']"
                ],
                "method": "click",
                "options": {
                  "wait": 2000
                }
              }
            ]
          },
          {
            "keywords": [
              "apply"
            ]
          }
        ]
      ],
      "forceConditions": {
        "urls": [
          "*://*.workable.com/view/*",
          "*://*.workable.com/search?*selectedJobId"
        ]
      },
      "continueFilling": true
    },
    "entities": [
      [
        "firstName",
        [
          ".//input[@data-ui='firstname']"
        ],
        {
          "keywords": [
            "first name"
          ]
        }
      ],
      [
        "lastName",
        [
          ".//input[@data-ui='lastname']"
        ],
        {
          "keywords": [
            "last name"
          ]
        }
      ],
      [
        "email",
        [
          ".//input[@data-ui='email']"
        ],
        {
          "keywords": [
            "email"
          ]
        }
      ],
      [
        "phone",
        {
          "actions": [
            {
              "path": [
                ".//div[@data-ui='phone']//input[@type='tel']"
              ],
              "method": "typing"
            }
          ]
        },
        {
          "keywords": [
            "phone"
          ]
        }
      ],
      [
        "phoneCode",
        {
          "actions": [
            {
              "path": [
                ".//div[@data-ui='phone']//div[@role='combobox']"
              ],
              "method": "click"
            },
            {
              "path": [
                ".//div[@data-ui='phone']//ul[@role='listbox']"
              ],
              "method": "clickOption"
            }
          ]
        },
        {
          "keywords": [
            "phone"
          ]
        }
      ],
      [
        "headline",
        [
          ".//input[@data-ui='headline']"
        ],
        {
          "keywords": [
            "headline"
          ]
        }
      ],
      [
        "cityState",
        {
          "actions": [
            {
              "path": [
                ".//input[@data-ui='address']"
              ],
              "method": "setValue",
              "options": {
                "ignoreExistingValue": true
              }
            }
          ]
        },
        {
          "keywords": [
            "city",
            "state",
            "address"
          ]
        }
      ],
      [
        "summary",
        [
          ".//textarea[@data-ui='summary']"
        ],
        {
          "keywords": [
            "summary"
          ]
        }
      ],
      [
        "resume",
        {
          "actions": [
            {
              "path": [
                ".//input[@data-ui='resume']"
              ],
              "method": "uploadResume"
            },
            {
              "path": [
                "//span[translate(normalize-space(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz')='cv']/ancestor::div[.//input[@type='file']][1]//input[@type='file']"
              ],
              "method": "uploadResume"
            }
          ]
        },
        {
          "keywords": [
            "resume"
          ]
        }
      ],
      [
        "experience",
        {
          "addButtonPath": [
            ".//div[@data-ui='experience']//button[@data-ui='add-section']"
          ],
          "containerPath": [
            ".//div[@data-ui='experience']//div[@data-ui='editor']"
          ],
          "entryContainer": {
            "title": [
              "//div[@data-ui='experience']//ul//li//dd[contains(@data-ui, 'title')]"
            ]
          },
          "formError": [
            ".//span[contains(@id, '_error')]"
          ],
          "entities": [
            [
              "title",
              [
                ".//input[@id='title']"
              ],
              {
                "keywords": [
                  "title"
                ]
              }
            ],
            [
              "companyName",
              [
                ".//input[@id='company']"
              ],
              {
                "keywords": [
                  "company"
                ]
              }
            ],
            [
              "description",
              [
                ".//textarea[@id='summary']"
              ],
              {
                "keywords": [
                  "description",
                  "summary"
                ]
              }
            ],
            [
              "startDate",
              {
                "actions": [
                  {
                    "path": [
                      ".//input[@name='start_date']"
                    ],
                    "method": "click"
                  },
                  {
                    "path": [
                      ".//input[@name='start_date']"
                    ],
                    "method": "typing"
                  },
                  {
                    "path": [
                      ".//input[@name='start_date']"
                    ],
                    "method": "pressEnterKey"
                  }
                ]
              },
              {
                "keywords": [
                  "start date"
                ]
              }
            ],
            [
              "endDate",
              {
                "actions": [
                  {
                    "path": [
                      ".//input[@name='end_date']"
                    ],
                    "method": "click"
                  },
                  {
                    "path": [
                      ".//input[@name='end_date']"
                    ],
                    "method": "typing"
                  },
                  {
                    "path": [
                      ".//input[@name='end_date']"
                    ],
                    "method": "pressEnterKey"
                  }
                ]
              },
              {
                "keywords": [
                  "end date"
                ]
              }
            ],
            [
              "isCurrent",
              [
                ".//input[@name='current']"
              ],
              {
                "keywords": [
                  "currently work"
                ]
              }
            ],
            [
              "saveButton",
              {
                "actions": [
                  {
                    "path": [
                      ".//button[@data-ui='save-section']"
                    ],
                    "method": "click",
                    "options": {
                      "waitForNetworkAfterInteraction": true
                    }
                  }
                ]
              },
              {
                "keywords": [
                  "update"
                ]
              }
            ],
            [
              "cancelButton",
              {
                "actions": [
                  {
                    "path": [
                      ".//button[@data-ui='cancel-section']"
                    ],
                    "method": "click",
                    "options": {
                      "clickIfPresent": [
                        ".//span[contains(@id, '_error')]"
                      ]
                    }
                  }
                ]
              },
              {
                "keywords": [
                  "cancel"
                ]
              }
            ]
          ]
        },
        {
          "keywords": [
            "experience"
          ]
        }
      ],
      [
        "education",
        {
          "addButtonPath": [
            ".//button[@data-ui='add-section' and contains(translate(@aria-label, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'education')]"
          ],
          "containerPath": [
            ".//div[@data-ui='education']//div[@data-ui='editor']"
          ],
          "entryContainer": {
            "subtitle": [
              "//div[@data-ui='education']//ul//li//dd[contains(@data-ui, 'school')]"
            ]
          },
          "formError": [
            ".//span[contains(@id, '_error')]"
          ],
          "entities": [
            [
              "name",
              [
                ".//input[@id='school']"
              ],
              {
                "keywords": [
                  "school"
                ]
              }
            ],
            [
              "major",
              [
                ".//input[@id='field_of_study']"
              ],
              {
                "keywords": [
                  "field of study",
                  "major"
                ]
              }
            ],
            [
              "degreeDisplay",
              [
                ".//input[@id='degree']"
              ],
              {
                "keywords": [
                  "degree"
                ]
              }
            ],
            [
              "startDate",
              {
                "actions": [
                  {
                    "path": [
                      ".//input[@name='start_date']"
                    ],
                    "method": "click"
                  },
                  {
                    "path": [
                      ".//input[@name='start_date']"
                    ],
                    "method": "typing"
                  },
                  {
                    "path": [
                      ".//input[@name='start_date']"
                    ],
                    "method": "pressEnterKey"
                  }
                ]
              },
              {
                "keywords": [
                  "start date"
                ]
              }
            ],
            [
              "endDate",
              {
                "actions": [
                  {
                    "path": [
                      ".//input[@name='end_date']"
                    ],
                    "method": "click"
                  },
                  {
                    "path": [
                      ".//input[@name='end_date']"
                    ],
                    "method": "typing"
                  },
                  {
                    "path": [
                      ".//input[@name='end_date']"
                    ],
                    "method": "pressEnterKey"
                  }
                ]
              },
              {
                "keywords": [
                  "end date"
                ]
              }
            ],
            [
              "isCurrent",
              [
                ".//input[@name='current']"
              ],
              {
                "keywords": [
                  "currently"
                ]
              }
            ],
            [
              "saveButton",
              {
                "actions": [
                  {
                    "path": [
                      ".//button[@data-ui='save-section']"
                    ],
                    "method": "click",
                    "options": {
                      "waitForNetworkAfterInteraction": true
                    }
                  }
                ]
              },
              {
                "keywords": [
                  "update"
                ]
              }
            ],
            [
              "cancelButton",
              {
                "actions": [
                  {
                    "path": [
                      ".//button[@data-ui='cancel-section']"
                    ],
                    "method": "click",
                    "options": {
                      "clickIfPresent": [
                        ".//span[contains(@id, '_error')]"
                      ]
                    }
                  }
                ]
              },
              {
                "keywords": [
                  "cancel"
                ]
              }
            ]
          ]
        },
        {
          "keywords": [
            "education"
          ]
        }
      ]
    ],
    "alwaysSyncWindowId": true,
    "screenshot": {
      "hide": [
        "nav[role='navigation']"
      ]
    },
    "autoFillOptions": {
      "selectors": {
        "date": "input[type='text'][inputmode='tel'][placeholder*='MM'], input[type='text'][inputmode='tel'][placeholder*='DD'], input[type='text'][inputmode='tel'][placeholder*='YYYY']"
      },
      "settings": {
        "date": {
          "mode": "typing"
        }
      }
    }
  },
  "workday": {
    "atsName": "workday",
    "urls": [
      "*://*.myworkdayjobs.com/*/apply*",
      "*://*.myworkdaysite.com/*/apply*",
      "*://*.myworkdayjobs.com/*/login*",
      "*://*.myworkdaysite.com/*/login*",
      "*://*.myworkdayjobs.com/*/completed*",
      "*://*.myworkdaysite.com/*/completed*",
      "*://*.myworkdayjobs.com/*/userHome*",
      "*://*.myworkdaysite.com/*/userHome*",
      "*://community.workday.com/maintenance-page*"
    ],
    "globalOptions": {
      "waitForAllRequestsBeforeFillingStep": true
    },
    "detectPageQuestions": true,
    "networkOptions": {
      "blacklistedUrlParts": [
        "linkedin",
        "analytics",
        "insights",
        "collect",
        "termsdata"
      ]
    },
    "submitButtonPaths": [
      ".//button[@data-automation-id='bottom-navigation-next-button' and contains(., 'Submit')]",
      ".//button[@data-automation-id='pageFooterNextButton' and contains(., 'Submit')]"
    ],
    "nextStepButtonPaths": [
      ".//button[@data-automation-id='bottom-navigation-next-button' and not(contains(., 'Submit'))]",
      ".//button[@data-automation-id='pageFooterNextButton' and not(contains(., 'Submit'))]"
    ],
    "backStepButtonPaths": [
      ".//button[@data-automation-id='bottom-navigation-back-button']"
    ],
    "backStepDiscardButtonPaths": [
      ".//button[@data-automation-id='discardButton']"
    ],
    "autoFillOptions": {
      "patterns": {
        "date": [
          "dateSection"
        ],
        "fillAtEnd": [
          "dateSection"
        ]
      },
      "dateOrder": [
        "year",
        "month",
        "day"
      ]
    },
    "validationErrorXPaths": [
      ".//p[@data-automation-id='inputError']"
    ],
    "pageFailureKeywords": [
      "something went wrong"
    ],
    "errorBannerXPaths": [
      "//button[@data-automation-id='errorBanner']",
      "//div[@data-automation-id='errorHeading']",
      "//div[@data-automation-id='errorMessage']"
    ],
    "verificationRequired": {
      "errorXPath": [
        "//div[@data-automation-id='errorMessage' and CONTAINS_TEXT('verify', true) and CONTAINS_TEXT('account', true)]",
        "//p[@data-automation-id='alertMessage' and CONTAINS_TEXT('verify', true) and CONTAINS_TEXT('email', true)]"
      ]
    },
    "questionValidationErrorSelectors": [
      "[aria-describedby*='error']",
      "[aria-invalid*='true']"
    ],
    "targetNodeXPath": [
      "//div[@id='mainContent' and not(./div/div[@data-automation-id='errorContainer'])]",
      "//div[@data-automation-id='applyFlowPage' and not(./main/div[@data-automation-id='invalid-content'])]",
      "//div[@data-automation-id='ApplyFlowPage' and not(./main/div[@data-automation-id='invalid-content'])]",
      "//div[@data-automation-id='jobPostingPage']"
    ],
    "expiredJob": [
      {
        "container": [
          "//div[@id='mainContent']/div/div[@data-automation-id='errorContainer']"
        ],
        "keywords": []
      }
    ],
    "canJobBeAppliedXPaths": {
      "applyButton": [
        ".//a[@data-automation-id='continueButton']",
        ".//a[@data-automation-id='adventureButton']"
      ]
    },
    "formatElements": "div[data-automation-id='selectedItem']",
    "customQuestions": {
      "patterns": {
        "questionId": "input-, primaryQuestionnaire-",
        "questionParent": "[data-automation-id^=formField-]"
      },
      "selectors": {
        "title": "h2",
        "subTitle": "h3",
        "label": "label[for^='__questionId__']",
        "legend": "legend[for^='__questionId__']",
        "ariaLabelledBy": "[aria-labelledby*=__labelId__]",
        "roleOption": "[role='option'] [data-automation-id='promptOption'], li[role='option'] div",
        "radioInput": "input[type='radio']",
        "monthInput": "input[aria-valuetext='MM']",
        "dateInput": "input[aria-valuetext='DD']",
        "yearInput": "input[aria-valuetext='YYYY']",
        "checkbox": "input[type='checkbox']",
        "questionParent": "div[data-automation-id*='formField']",
        "mapOption": "[role='option'] [data-automation-id='promptOption'], li[role='option'] div"
      },
      "xpaths": {
        "currentListItem": [
          "//div[@data-automation-id='menuItem'][@aria-posinset='__itemIndex__']"
        ],
        "listInputBackBtnText": [
          "//div[@data-automation-id='multiSelectHeader']//text()"
        ],
        "selectPopupXPath": [
          ".//div[@data-automation-widget='wd-popup'][@data-automation-activepopup='true']//div[@role='presentation']"
        ],
        "listBoxPopupXPath": [
          ".//div[@data-automation-widget='wd-popup'][@data-automation-activepopup='true']//ul[@role='listbox']",
          ".//div[@visibility='opened']//ul[@role='listbox']"
        ],
        "selectedItemListXPath": [
          ".//ul[@data-automation-id='selectedItemList']//li[@data-automation-id='menuItem']"
        ],
        "requiredFieldXPath": [
          ".//abbr[@class='requiredAsterisk']",
          ".//span[CONTAINS_TEXT('*', true)]"
        ]
      },
      "ignoreQuestions": [
        "//button[@data-automation-id='select-files']",
        "//div[contains(@data-automation-id, '-display')]",
        "//div[contains(@id, 'helpText')]",
        "//div[contains(@data-automation-id, 'dateInputWrapper')]",
        "//div[contains(@aria-labelledby, 'hiddenDateValueId')]",
        "//input[@data-automation-id='beecatcher']",
        ".//button[@data-automation-id='degree']",
        ".//div[contains(@data-automation-id, 'degree')]//button",
        "//div[@data-automation-id='formField-certification-issue-date']//input",
        "//div[@data-automation-id='formField-certification-expiration-date']//input",
        "//div[contains(@data-automation-id, 'issuedDate')]//input",
        "//div[contains(@data-automation-id, 'expirationDate')]//input",
        "//fieldset[contains(@data-automation-id, 'CheckboxGroup')]//input[@type='checkbox']",
        "//input[contains(@id, 'countryPhoneCode')]",
        "//button[contains(@id, 'disabilityForm') and contains(@aria-label, 'Language')]"
      ],
      "handlePseudoCheckboxes": true
    },
    "jobXPaths": {
      "entities": [
        [
          "titleDisplay",
          [
            ".//h2[@data-automation-id='jobPostingHeader']",
            ".//div[@data-automation-id='jobPostingHeader']",
            ".//h3[@data-automation-id='jobTitleHeading']",
            ".//h1[@class='job-title']",
            "//meta[@property='og:title']/@content"
          ]
        ],
        [
          "originalCompanyName",
          [
            "//img[@data-automation-id='logo']/@src",
            ".//img[@data-automation-id='banner']/@src"
          ]
        ],
        [
          "jobTypes",
          [
            ".//section[@data-automation-id='jobDetails']//div[@data-automation-id='time']//dd",
            ".//div[@data-automation-id='time']//dd"
          ]
        ],
        [
          "postingDate",
          [
            ".//section[@data-automation-id='jobDetails']//div[@data-automation-id='postedOn']//dd",
            ".//div[@data-automation-id='postedOn']//dd"
          ]
        ],
        [
          "url",
          [
            ".//meta[@property='og:url']/@content"
          ]
        ],
        [
          "desc",
          [
            ".//section[@data-automation-id='jobDetails']//div[@data-automation-id='jobPostingDescription']",
            ".//div[@data-automation-id='jobPostingDescription']",
            ".//meta[@property='og:description']/@content"
          ]
        ],
        [
          "locationDisplay",
          [
            "//section[@data-automation-id='jobDetails']//div[@data-automation-id='locations']//dd",
            "//div[@data-automation-id='locations']//dd"
          ]
        ]
      ]
    },
    "contextData": {
      "classifier": {
        "applyBtnPath": [
          "//a[contains(@href, 'myworkdayjobs.com') and (contains(@href, '/job/') or contains(@href, '/apply')) and CONTAINS_TEXT('apply', true)]",
          "//a[contains(@href, 'myworkdaysite.com') and (contains(@href, '/job/') or contains(@href, '/apply')) and CONTAINS_TEXT('apply', true)]"
        ]
      },
      "options": {}
    },
    "preApply": {
      "urls": [
        "*://*.myworkdayjobs.com/*/job/*",
        "*://*.myworkdaysite.com/*/job/*"
      ],
      "entities": [
        [
          "applyBtn",
          {
            "actions": [
              {
                "key": "canJobBeAppliedXPaths.applyButton",
                "method": "click",
                "time": 500
              },
              {
                "path": [
                  ".//a[@data-automation-id='applyManually']"
                ],
                "method": "click"
              }
            ]
          }
        ]
      ],
      "reloadPageAfterDelay": 100
    },
    "signIn": {
      "urls": [
        "*://*.myworkdayjobs.com/*/login*",
        "*://*.myworkdaysite.com/*/login*"
      ],
      "formPath": [
        "//div[@data-automation-id='signInContent']"
      ],
      "submitButton": [
        "//div[@data-automation-id='click_filter' and @aria-label='Sign In']",
        "//div[@data-automation-id='click_filter' and following-sibling::button[@data-automation-id='signInSubmitButton']][1]"
      ],
      "toSignInButton": [
        "//button[@data-automation-id='signInLink']"
      ],
      "createAccount": [
        "//button[@data-automation-id='createAccountLink']",
        "//button[@data-automation-id='createAccountSubmitButton']"
      ],
      "signInWithEmail": [
        "//button[@data-automation-id='SignInWithEmailButton']"
      ],
      "forgotPassword": [
        "//button[@data-automation-id='forgotPasswordLink']"
      ],
      "email": [
        "//div[@data-automation-id='formField-email']//input"
      ],
      "password": [
        "//div[@data-automation-id='formField-password']//input",
        "//input[@type='password' and @data-automation-id='password']"
      ],
      "errorMessage": [
        "//div[@data-automation-id='errorMessage']"
      ],
      "wrongCredentialsError": [
        ".//p[CONTAINS_TEXT('wrong', true) and CONTAINS_TEXT('email', true)]"
      ],
      "endpoint": "/login"
    },
    "signUp": {
      "errorMessage": [
        "//div[@data-automation-id='errorMessage']",
        "//p[@data-automation-id='inputError']"
      ],
      "submitButton": [
        "//div[@data-automation-id='click_filter' and @aria-label='Create Account']",
        "//div[@data-automation-id='click_filter' and following-sibling::button[@data-automation-id='createAccountSubmitButton']][1]"
      ],
      "formStepPath": [
        "//div[@data-automation-id='signInContent']"
      ],
      "email": [
        "//div[@data-automation-id='formField-email']//input"
      ],
      "password": [
        "//div[@data-automation-id='formField-password']//input"
      ],
      "verifyPassword": [
        "//div[@data-automation-id='formField-verifyPassword']//input"
      ],
      "endpoint": "/register",
      "saveStrategy": "onRedirect",
      "agreementPath": [
        "//input[@data-automation-id='createAccountCheckbox']"
      ]
    },
    "sections": {
      "path": [
        ".//h2"
      ],
      "section": [
        {
          "title": [
            "Review"
          ],
          "entities": []
        },
        {
          "title": [
            "Start Your Application"
          ],
          "entities": [
            "applyBtn"
          ]
        },
        {
          "title": [
            "My Information"
          ],
          "entities": [
            "answerSource",
            "email",
            "firstName",
            "lastName",
            "addressLine1",
            "phoneType",
            "phoneCode",
            "stateName",
            "city",
            "postalCode",
            "phoneStripped",
            "countryName",
            "county"
          ]
        },
        {
          "title": [
            "My Experience",
            "Education",
            "Certifications",
            "Skills"
          ],
          "entities": [
            "experience",
            "companyName",
            "title",
            "stateName",
            "description",
            "startDate",
            "endDate",
            "startDateMonthText",
            "startDateYear",
            "startDateMonth_MM",
            "cityState",
            "isCurrent",
            "education",
            "name",
            "degree",
            "major",
            "gpa",
            "startDateYear",
            "endDateYear",
            "certification",
            "name",
            "issueDateSlashes_MMDDYYYY",
            "skill",
            "name",
            "language",
            "resume"
          ]
        },
        {
          "title": [
            "Application Questions",
            "Voluntary Disclosures",
            "Self Identify"
          ],
          "entities": [
            "over18",
            "workAuth",
            "fullName",
            "applyDate",
            "disability",
            "sponsorship",
            "lgbt",
            "armedForces",
            "currentDate",
            "currentDateDashes",
            "workStartDateAvailabilityString",
            "agreement"
          ]
        }
      ]
    },
    "entities": [
      [
        "applyBtn",
        [
          {
            "actions": [
              {
                "path": [
                  ".//a[@data-automation-id='applyManually']"
                ],
                "method": "click"
              }
            ]
          }
        ],
        {
          "keywords": [
            "Apply"
          ]
        }
      ],
      [
        "answerSource",
        [
          {
            "actions": [
              {
                "path": [
                  ".//div[@data-automation-id='formField-sourcePrompt']//div[@data-automation-id='multiselectInputContainer']//input",
                  ".//div[@data-automation-id='formField-sourceDropdown']//button[@data-automation-id='sourceDropdown']",
                  ".//div[@data-automation-id='formField-source']//*[@id='source--source']"
                ],
                "method": "click",
                "options": {
                  "waitForNetworkBeforeInteraction": true,
                  "waitForNetworkAfterInteraction": true
                }
              },
              {
                "path": [
                  "//div[@data-automation-widget='wd-popup']//ul",
                  "(//div[@data-automation-id='activeListContainer']//div)[1]",
                  "//ul[@id=//div[@data-automation-id='formField-source']//*[@id='source--source']/@aria-controls]",
                  "//div[@data-associated-widget=//div[@data-automation-id='formField-source']//*[@id='source--source']/@data-uxi-multiselect-id]"
                ],
                "method": "clickOptionWithMultiAnswers",
                "values": {
                  "source": [
                    "Google",
                    "Other",
                    "job board",
                    "job site",
                    "website",
                    "social network"
                  ]
                },
                "backButtonPath": [
                  ".//span[@data-automation-id='backButton']"
                ],
                "listItemPath": [
                  ".//div[@data-automation-id='promptLeafNode']",
                  ".//li[@role='option']"
                ],
                "options": {
                  "waitForNetworkBeforeInteraction": true,
                  "deepSearch": true,
                  "lowPriority": [
                    "Indeed",
                    "ZipRecruiter",
                    "LinkedIn",
                    "Glassdoor",
                    "Simplyhired",
                    "Dice",
                    "CareerBuilder",
                    "Monster"
                  ],
                  "prohibited": [
                    "referral",
                    "referred",
                    "connection",
                    "at the company",
                    "for the organization",
                    "employee",
                    "select",
                    "current worker",
                    "used to work at"
                  ],
                  "selectFirstExcludingProhibited": true
                }
              },
              {
                "path": [
                  "//div[contains(@data-automation-id, 'referredBy')]//input"
                ],
                "method": "setValue",
                "defaultValue": "Job Board",
                "options": {
                  "waitForNetworkBeforeInteraction": true
                }
              }
            ]
          }
        ],
        {
          "keywords": [
            "Hear About"
          ]
        }
      ],
      [
        "countryName",
        [
          {
            "actions": [
              {
                "path": [
                  ".//button[@data-automation-id='countryDropdown']",
                  ".//div[@data-automation-id='formField-country']//button[@id='country--country']"
                ],
                "method": "click"
              },
              {
                "path": [
                  "//div[@data-automation-activepopup='true']//ul[@role='listbox']//li[@role='option' and starts-with(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'united states of america')]",
                  "//ul[@id=//div[@data-automation-id='formField-country']//button[@id='country--country']/@aria-controls]//li[@role='option' and starts-with(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'united states of america')]"
                ],
                "method": "click",
                "options": {
                  "waitForNetworkAfterInteraction": false,
                  "wait": 0
                }
              }
            ]
          },
          {
            "actions": [
              {
                "path": [
                  ".//input[@data-automation-id='addressSection_regionSubdivision1']"
                ],
                "method": "setValue",
                "defaultValue": "United States of America",
                "options": {
                  "wait": 0,
                  "waitForNetworkAfterInteraction": true
                }
              }
            ]
          }
        ],
        {
          "keywords": [
            "Country"
          ]
        }
      ],
      [
        "county",
        {
          "actions": [
            {
              "path": [
                ".//div[@data-automation-id='formField-regionSubdivision1']//input"
              ],
              "method": "getCounty"
            },
            {
              "path": [
                ".//div[@data-automation-id='formField-regionSubdivision1']//input"
              ],
              "method": "setValue",
              "options": {
                "waitForNetworkBeforeInteraction": false,
                "wait": 0
              }
            }
          ]
        },
        {
          "keywords": [
            "county"
          ]
        }
      ],
      [
        "email",
        {
          "actions": [
            {
              "path": [
                ".//div[@id='textInput.email']//input[@type='text']",
                ".//div[@data-automation-id='formField-emailAddress']//input[@type='text']",
                ".//input[@data-automation-id='email']"
              ],
              "method": "setValue",
              "options": {
                "wait": 0
              }
            }
          ]
        },
        {
          "keywords": [
            "Email"
          ]
        }
      ],
      [
        "firstName",
        {
          "actions": [
            {
              "path": [
                ".//div[contains(@data-automation-id, 'firstName')]//input[@type='text']"
              ],
              "method": "setValue",
              "options": {
                "wait": 0
              }
            }
          ]
        },
        {
          "keywords": [
            "First Name",
            "Given Name"
          ]
        }
      ],
      [
        "lastName",
        {
          "actions": [
            {
              "path": [
                ".//div[contains(@data-automation-id, 'lastName')]//input[@type='text']"
              ],
              "method": "setValue",
              "options": {
                "wait": 0
              }
            }
          ]
        },
        {
          "keywords": [
            "Last Name",
            "Family Name"
          ]
        }
      ],
      [
        "addressLine1",
        {
          "actions": [
            {
              "path": [
                ".//div[contains(@data-automation-id, 'addressLine1')]//input[@type='text']"
              ],
              "method": "setValue",
              "options": {
                "wait": 0
              }
            }
          ]
        },
        {
          "keywords": [
            "Address Line"
          ]
        }
      ],
      [
        "city",
        {
          "actions": [
            {
              "path": [
                ".//div[contains(@data-automation-id, 'city')]//input[@type='text']"
              ]
            }
          ]
        },
        {
          "keywords": [
            "City"
          ]
        }
      ],
      [
        "phoneStripped",
        {
          "actions": [
            {
              "path": [
                ".//div[@data-automation-id='formField-phone-number']//input[@type='text']",
                ".//input[@data-automation-id='phone-number']",
                ".//div[contains(@data-automation-id, 'phoneNumber')]//input[@type='text']"
              ],
              "method": "setValue",
              "options": {
                "wait": 0
              }
            }
          ]
        },
        {
          "keywords": [
            "Phone Number"
          ]
        }
      ],
      [
        "phoneCode",
        {
          "actions": [
            {
              "path": [
                ".//div[@data-automation-id='formField-country-phone-code']//input"
              ],
              "method": "setValue",
              "options": {
                "wait": 0
              }
            }
          ]
        },
        {
          "keywords": [
            "Phone Code",
            "Country Phone Code"
          ]
        }
      ],
      [
        "stateName",
        {
          "actions": [
            {
              "path": [
                ".//button[@data-automation-id='addressSection_countryRegion']",
                ".//div[contains(@data-automation-id, 'countryRegion')]//button[contains(@id, 'countryRegion')]"
              ],
              "method": "click"
            },
            {
              "path": [
                "//div[@data-automation-activepopup='true']",
                "//ul[@id=//div[contains(@data-automation-id, 'countryRegion')]//button[contains(@id, 'countryRegion')]/@aria-controls]"
              ],
              "method": "clickOption",
              "options": {
                "wait": 0
              }
            }
          ]
        },
        {
          "keywords": [
            "State"
          ]
        }
      ],
      [
        "postalCode",
        {
          "actions": [
            {
              "path": [
                ".//div[contains(@data-automation-id, 'postalCode')]//input[@type='text']"
              ],
              "method": "setValue",
              "options": {
                "wait": 0
              }
            }
          ]
        },
        {
          "keywords": [
            "Postal Code"
          ]
        }
      ],
      [
        "phoneType",
        {
          "actions": [
            {
              "path": [
                "//button[@data-automation-id='phone-device-type']",
                "//div[@data-automation-id='formField-phoneType']//button[@id='phoneNumber--phoneType']"
              ],
              "method": "click"
            },
            {
              "path": [
                "//div[@data-automation-activepopup='true']",
                "//ul[@id=//div[@data-automation-id='formField-phoneType']//button[@id='phoneNumber--phoneType']/@aria-controls]"
              ],
              "method": "clickOption",
              "values": {
                "mobile": [
                  "Personal Mobile",
                  "Personal Phone",
                  "Personal Primary",
                  "Cell",
                  "Personal",
                  "Mobile"
                ]
              },
              "options": {
                "wait": 0,
                "waitForNetworkBeforeInteraction": true
              }
            }
          ]
        },
        {
          "keywords": [
            "Phone Device",
            "Device Type"
          ]
        }
      ],
      [
        "experience",
        {
          "addButtonPath": [
            ".//button[starts-with(@aria-label, 'Add') and contains(@aria-label, 'Experience')]",
            ".//button[starts-with(@aria-label, 'Add Another Work History')]",
            ".//button[starts-with(@aria-label, 'Add Work History')]",
            ".//button[starts-with(@aria-label, 'Add Work Experience')]",
            "//div[@data-automation-id='workExperienceSection']//button[contains(@aria-label, 'Add Another')]",
            "//div[@data-automation-id='workExperienceSection']//button[@data-automation-id='Add']",
            "//div[contains(@aria-labelledby, 'History-section')]//button[@data-automation-id='add-button']",
            "//div[contains(@aria-labelledby, 'Experience-section')]//button[@data-automation-id='add-button']"
          ],
          "options": {
            "afterAddButtonAsyncDelay": 30000
          },
          "confirmAddedPath": [
            ".//div[@data-automation-id='workExperience-__indexPlusOne__']",
            ".//div[contains(@aria-labelledby, 'Experience-__indexPlusOne__-panel')]",
            ".//div[contains(@aria-labelledby, 'History-__indexPlusOne__-panel')]"
          ],
          "containerPath": [
            ".//div[@data-automation-id='workExperience-__indexPlusOne__']",
            ".//div[contains(@aria-labelledby, 'Experience-__indexPlusOne__-panel')]",
            ".//div[contains(@aria-labelledby, 'History-__indexPlusOne__-panel')]"
          ],
          "entities": [
            [
              "title",
              {
                "actions": [
                  {
                    "path": [
                      ".//input[@data-automation-id='jobTitle']",
                      ".//div[contains(@data-automation-id, 'jobTitle')]//input[@type='text']"
                    ],
                    "method": "setValue",
                    "options": {
                      "wait": 0
                    }
                  }
                ]
              },
              {
                "keywords": [
                  "Job Title"
                ]
              }
            ],
            [
              "companyName",
              {
                "actions": [
                  {
                    "path": [
                      ".//input[@data-automation-id='company']",
                      ".//div[contains(@data-automation-id, 'companyName')]//input[@type='text']"
                    ],
                    "method": "setValue",
                    "options": {
                      "wait": 0
                    }
                  }
                ]
              },
              {
                "keywords": [
                  "Company"
                ]
              }
            ],
            [
              "cityState",
              {
                "actions": [
                  {
                    "path": [
                      ".//input[@data-automation-id='location']",
                      ".//div[contains(@data-automation-id, 'location')]//input[@type='text']"
                    ],
                    "method": "setValue",
                    "options": {
                      "wait": 0
                    }
                  }
                ]
              },
              {
                "keywords": [
                  "Location"
                ]
              }
            ],
            [
              "isCurrent",
              {
                "actions": [
                  {
                    "path": [
                      ".//input[@data-automation-id='currentlyWorkHere']",
                      ".//div[contains(@data-automation-id, 'currentlyWorkHere')]//input[@type='checkbox']"
                    ],
                    "method": "clickCheckbox",
                    "options": {
                      "wait": 0
                    }
                  }
                ]
              },
              {
                "keywords": [
                  "Currently work"
                ]
              }
            ],
            [
              "startDate",
              {
                "actions": [
                  {
                    "method": "setDateInput",
                    "format": "MM/yyyy",
                    "month": {
                      "path": [
                        ".//div[@data-automation-id='formField-startDate']//input[@aria-label='Month' or @data-automation-id='dateSectionMonth-input']"
                      ],
                      "format": "MM",
                      "options": {
                        "triggerBlurEvent": false,
                        "triggerBlurInInactiveTab": true,
                        "wait": 0
                      }
                    },
                    "year": {
                      "path": [
                        ".//div[@data-automation-id='formField-startDate']//input[@aria-label='Year' or @data-automation-id='dateSectionYear-input']"
                      ],
                      "format": "yyyy",
                      "options": {
                        "waitForNetworkBeforeInteraction": false,
                        "waitForNetworkAfterInteraction": false,
                        "triggerBlurEvent": false,
                        "triggerBlurInInactiveTab": true,
                        "wait": 0
                      }
                    }
                  }
                ]
              },
              {
                "keywords": [
                  "From"
                ]
              }
            ],
            [
              "endDate",
              {
                "actions": [
                  {
                    "method": "setDateInput",
                    "format": "MM/yyyy",
                    "month": {
                      "path": [
                        ".//div[@data-automation-id='formField-endDate']//input[@aria-label='Month']"
                      ],
                      "format": "MM",
                      "options": {
                        "triggerBlurEvent": false,
                        "triggerBlurInInactiveTab": true,
                        "wait": 0
                      }
                    },
                    "year": {
                      "path": [
                        ".//div[@data-automation-id='formField-endDate']//input[@aria-label='Year']"
                      ],
                      "format": "yyyy",
                      "options": {
                        "waitForNetworkBeforeInteraction": false,
                        "waitForNetworkAfterInteraction": false,
                        "triggerBlurEvent": false,
                        "triggerBlurInInactiveTab": true,
                        "wait": 0
                      }
                    }
                  }
                ]
              },
              {
                "keywords": [
                  "To"
                ]
              }
            ],
            [
              "description",
              {
                "actions": [
                  {
                    "path": [
                      ".//textarea[@data-automation-id='description']",
                      ".//div[contains(@data-automation-id, 'roleDescription')]//textarea"
                    ],
                    "method": "setValue",
                    "options": {
                      "wait": 0
                    }
                  }
                ]
              },
              {
                "keywords": [
                  "Description"
                ]
              }
            ]
          ]
        },
        {
          "keywords": [
            "Experience"
          ]
        }
      ],
      [
        "education",
        {
          "addButtonPath": [
            ".//button[@aria-label='Add Education']",
            "//div[@data-automation-id='educationSection']//button[contains(@aria-label, 'Add Another')]",
            "//div[@data-automation-id='educationSection']//button[@data-automation-id='Add']",
            "//div[@aria-labelledby='Education-section']//button[@data-automation-id='add-button']",
            "//div[starts-with(translate(@aria-labelledby, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'highest-level-of-education-')]//button[@data-automation-id='add-button']",
            "//div[@aria-labelledby='Schooling-section']//button[@data-automation-id='add-button']"
          ],
          "options": {
            "afterAddButtonAsyncDelay": 30000,
            "getRelevantEntities": true
          },
          "confirmAddedPath": [
            ".//div[@data-automation-id='education-__indexPlusOne__']",
            ".//div[@aria-labelledby='Education-__indexPlusOne__-panel']",
            ".//div[@aria-labelledby='Schooling-__indexPlusOne__-panel']"
          ],
          "containerPath": [
            ".//div[@data-automation-id='education-__indexPlusOne__']",
            ".//div[@aria-labelledby='Education-__indexPlusOne__-panel']",
            ".//div[starts-with(translate(@aria-labelledby, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'highest-level-of-education-') and contains(@aria-labelledby, '-__indexPlusOne__-panel')]",
            ".//div[@aria-labelledby='Schooling-__indexPlusOne__-panel']"
          ],
          "entities": [
            [
              "name",
              [
                {
                  "actions": [
                    {
                      "path": [
                        ".//div[contains(@data-automation-id, 'schoolName')]//input[@type='text' and not(@placeholder)]",
                        ".//div[@data-automation-id='formField-school']//input[@data-automation-id='school' and not(@placeholder)]"
                      ],
                      "method": "setValue",
                      "options": {
                        "wait": 0
                      }
                    }
                  ]
                },
                {
                  "actions": [
                    {
                      "path": [
                        ".//div[@data-automation-id='formField-schoolItem']//input[@placeholder='Search']"
                      ],
                      "method": "click"
                    },
                    {
                      "path": [
                        ".//div[@data-automation-id='formField-schoolItem']//input[@placeholder='Search']",
                        ".//input[contains(@id, 'schoolName') and @type='text']"
                      ],
                      "method": "setValue",
                      "options": {
                        "triggerBlurEvent": false,
                        "resetValue": true
                      }
                    },
                    {
                      "path": [
                        ".//div[@data-automation-id='formField-schoolItem']//input[@placeholder='Search']"
                      ],
                      "method": "pressEnterKey",
                      "options": {
                        "waitForNetworkBeforeInteraction": true,
                        "waitForNetworkAfterInteraction": true
                      }
                    },
                    {
                      "path": [
                        "//div[@data-automation-widget='wd-popup']"
                      ],
                      "method": "clickOptionAsync",
                      "options": {
                        "noMatchesFallbackText": "Not Found",
                        "waitForNetworkBeforeInteraction": true,
                        "waitForNetworkAfterInteraction": true,
                        "similarMatch": true
                      }
                    }
                  ]
                },
                {
                  "actions": [
                    {
                      "path": [
                        ".//div[@data-automation-id='formField-school']//input[@placeholder='Search']"
                      ],
                      "method": "click"
                    },
                    {
                      "path": [
                        ".//div[@data-automation-id='formField-school']//input[@type='text']",
                        ".//div[@data-automation-id='formField-school']//input[@data-automation-id='searchBox']",
                        ".//div[@data-automation-id='formField-school']//input[contains(@id, 'school')]"
                      ],
                      "method": "setValue",
                      "options": {
                        "waitForNetworkBeforeInteraction": true,
                        "waitForNetworkAfterInteraction": true,
                        "trackQuestion": true,
                        "checkAcronym": true,
                        "resetValue": true
                      }
                    },
                    {
                      "path": [
                        ".//div[@data-automation-id='formField-school']//input[@data-automation-id='searchBox']",
                        ".//div[@data-automation-id='formField-school']//input[contains(@id, 'school')]"
                      ],
                      "method": "pressEnterKey",
                      "options": {
                        "waitForNetworkBeforeInteraction": true,
                        "waitForNetworkAfterInteraction": true
                      }
                    },
                    {
                      "path": [
                        "//div[@data-associated-widget=//div[contains(@data-automation-id, 'formField-school')]//div[@data-automation-id='multiSelectContainer'][1]/@id]"
                      ],
                      "method": "clickOption",
                      "options": {
                        "wait": 0,
                        "waitForNetworkAfterInteraction": true,
                        "waitForNetworkBeforeInteraction": true,
                        "checkAcronym": true,
                        "autocomplete": true,
                        "optionSelected": [
                          "//div[@aria-labelledby='Education-__indexPlusOne__-panel']//div[@data-automation-id='selectedItem']//p[@data-automation-id='promptOption']"
                        ],
                        "removeOption": [
                          "//div[@aria-labelledby='Education-__indexPlusOne__-panel']//div[@data-automation-id='DELETE_charm']"
                        ],
                        "fallbackOptionsArray": [
                          "Other",
                          "Not Listed",
                          "School Not Found",
                          "None Listed",
                          "Unspecified",
                          "Not Applicable",
                          "Other - School Not Found"
                        ]
                      }
                    }
                  ]
                }
              ],
              {
                "keywords": [
                  "School",
                  "University",
                  "School or University"
                ]
              }
            ],
            [
              "degree",
              {
                "actions": [
                  {
                    "path": [
                      ".//button[@data-automation-id='degree']",
                      ".//div[contains(@data-automation-id, 'degree')]//button"
                    ],
                    "method": "click",
                    "options": {
                      "trackQuestion": true
                    }
                  },
                  {
                    "path": [
                      "//div[@data-automation-widget='wd-popup']//ul",
                      "//ul[@id=//div[contains(@data-automation-id, 'degree')]//button/@aria-controls]"
                    ],
                    "method": "clickOption",
                    "values": {
                      "bachelor's": [
                        "Bachelor's Degree",
                        "Bachelors"
                      ],
                      "master's": [
                        "Master's Degree",
                        "Master of Science",
                        "Masters"
                      ],
                      "associate's": [
                        "Associate's Degree"
                      ]
                    },
                    "options": {
                      "forceOptionSearch": true,
                      "wait": 0,
                      "preserveSpecialChars": true,
                      "unmarkFilledStatusIfSomeFails": true
                    }
                  }
                ]
              },
              {
                "keywords": [
                  "Degree"
                ]
              }
            ],
            [
              "major",
              {
                "actions": [
                  {
                    "path": [
                      ".//div[@data-automation-id='formField-field-of-study']//input[@placeholder='Search']",
                      ".//div[contains(@data-automation-id, 'fieldOfStudy')]//input[@placeholder='Search']"
                    ],
                    "method": "click"
                  },
                  {
                    "path": [
                      ".//div[@data-automation-id='formField-field-of-study']//input[@placeholder='Search']",
                      ".//div[contains(@data-automation-id, 'fieldOfStudy')]//input[@placeholder='Search']"
                    ],
                    "method": "setValue",
                    "fallbackValue": "Other",
                    "options": {
                      "triggerBlurEvent": false,
                      "resetValue": true,
                      "trackQuestion": true
                    }
                  },
                  {
                    "path": [
                      ".//div[@data-automation-id='formField-field-of-study']//input[@placeholder='Search']",
                      ".//div[contains(@data-automation-id, 'fieldOfStudy')]//input[@placeholder='Search']"
                    ],
                    "method": "pressEnterKey",
                    "options": {
                      "waitForNetworkAfterInteraction": true,
                      "waitForNetworkBeforeInteraction": true,
                      "addedItemXpath": [
                        ".//div[@data-automation-id='formField-field-of-study']//div[@data-automation-id='selectedItem'][last()]",
                        ".//div[contains(@data-automation-id, 'fieldOfStudy')]//div[@data-automation-id='selectedItem'][last()]"
                      ]
                    }
                  },
                  {
                    "path": [
                      "//div[@data-automation-widget='wd-popup']",
                      "//div[@data-associated-widget=(//div[contains(@data-automation-id, 'fieldOfStudy')]//div[@data-automation-id='multiSelectContainer'])[__indexPlusOne__]/@id]//div[@data-automation-id='activeListContainer']"
                    ],
                    "method": "clickOption",
                    "options": {
                      "waitForNetworkAfterInteraction": true,
                      "waitForNetworkBeforeInteraction": true,
                      "autocomplete": true,
                      "optionSelected": [
                        "//div[@aria-labelledby='Education-__indexPlusOne__-panel']//div[contains(@data-automation-id, 'fieldOfStudy')]//div[@data-automation-id='selectedItem']//p[@data-automation-id='promptOption']"
                      ],
                      "removeOption": [
                        "//div[@aria-labelledby='Education-__indexPlusOne__-panel']//div[contains(@data-automation-id, 'fieldOfStudy')]//div[@data-automation-id='DELETE_charm']"
                      ],
                      "fallbackOptionsArray": [
                        "Other",
                        "Other Program",
                        "Unspecified"
                      ]
                    }
                  }
                ]
              },
              {
                "keywords": [
                  "Major",
                  "Field of Study"
                ]
              }
            ],
            [
              "startDateYear",
              {
                "actions": [
                  {
                    "path": [
                      ".//div[@data-automation-id='formField-startDate']//input[@aria-label='Year' or @data-automation-id='dateSectionYear-input']",
                      ".//div[contains(@data-automation-id, 'firstYearAttended')]//input"
                    ],
                    "method": "setValue",
                    "options": {
                      "wait": 0
                    }
                  }
                ]
              },
              {
                "keywords": [
                  "From"
                ]
              }
            ],
            [
              "endDateYear",
              {
                "actions": [
                  {
                    "path": [
                      ".//div[@data-automation-id='formField-endDate']//input[@aria-label='Year' or @data-automation-id='dateSectionYear-input']",
                      ".//div[contains(@data-automation-id, 'lastYearAttended')]//input"
                    ],
                    "method": "setValue",
                    "options": {
                      "wait": 0
                    }
                  }
                ]
              },
              {
                "keywords": [
                  "To",
                  "Expected"
                ]
              }
            ],
            [
              "gpa",
              {
                "actions": [
                  {
                    "path": [
                      ".//div[@data-automation-id='formField-gpa']//input[@data-automation-id='gpa']",
                      ".//div[contains(@data-automation-id,'gradeAverage')]//input"
                    ],
                    "method": "setValue",
                    "options": {
                      "wait": 0
                    }
                  }
                ]
              },
              {
                "keywords": [
                  "GPA",
                  "overall result"
                ]
              }
            ]
          ]
        },
        {
          "keywords": [
            "Education",
            "School",
            "Schooling"
          ]
        }
      ],
      [
        "certification",
        {
          "addButtonPath": [
            ".//button[@aria-label='Add Certifications']",
            ".//div[@data-automation-id='certifications-section']//button[contains(@aria-label, 'Add')]",
            "//div[contains(@aria-labelledby, 'Certifications-section')]//button[@data-automation-id='add-button']"
          ],
          "options": {
            "afterAddButtonAsyncDelay": 30000
          },
          "confirmAddedPath": [
            ".//div[@data-automation-id='certification-__indexPlusOne__']",
            ".//div[@data-automation-id='panel-__indexPlusOne__']",
            ".//div[contains(@aria-labelledby, 'Certifications-__indexPlusOne__-panel')]"
          ],
          "containerPath": [
            ".//div[@data-automation-id='certifications-__indexPlusOne__']",
            ".//div[@data-automation-id='certifications-section']//div[@data-automation-id='panel-__indexPlusOne__']",
            ".//div[contains(@aria-labelledby, 'Certifications-__indexPlusOne__-panel')]"
          ],
          "entities": [
            [
              "name",
              {
                "actions": [
                  {
                    "path": [
                      ".//input[@placeholder='Search']",
                      ".//div[contains(@data-automation-id, 'certification')]//input[@placeholder='Search']"
                    ],
                    "method": "click"
                  },
                  {
                    "path": [
                      ".//input[@placeholder='Search']",
                      ".//div[contains(@data-automation-id, 'certification')]//input[@placeholder='Search']"
                    ],
                    "method": "setValue",
                    "options": {
                      "triggerBlurEvent": false,
                      "trackQuestion": true,
                      "resetValue": true
                    }
                  },
                  {
                    "path": [
                      ".//div[contains(@data-automation-id, 'certification')]//input[@placeholder='Search']"
                    ],
                    "method": "pressEnterKey",
                    "options": {
                      "waitForNetworkBeforeInteraction": true,
                      "waitForNetworkAfterInteraction": true
                    }
                  },
                  {
                    "path": [
                      "//div[@data-associated-widget=(//div[contains(@data-automation-id, 'certification')]//div[@data-automation-id='multiSelectContainer'])[__indexPlusOne__]/@id]//div[contains(@class, 'Virtualized')]"
                    ],
                    "method": "clickOption",
                    "options": {
                      "waitForNetworkBeforeInteraction": true,
                      "waitForNetworkAfterInteraction": true,
                      "skipNextFieldsIfNoMatch": true,
                      "autocomplete": true,
                      "optionSelected": [
                        "//div[@data-automation-id='panel-__indexPlusOne__']//div[@data-automation-id='formField-certification']//p[@data-automation-id='promptOption']"
                      ],
                      "removeButton": [
                        ".//button[@aria-label='Delete Certifications / Professional Licenses __indexPlusOne__']",
                        ".//button[@aria-label='Delete Certifications __indexPlusOne__']",
                        ".//button[contains(text(), 'Delete')]"
                      ],
                      "ignoreMultipleLevelsDropdown": true
                    }
                  }
                ]
              }
            ],
            [
              "issueDateSlashes_MMDDYYYY",
              {
                "actions": [
                  {
                    "method": "setDateInput",
                    "format": "MM/dd/yyyy",
                    "month": {
                      "path": [
                        ".//div[@data-automation-id='formField-certification-issue-date']//input[@aria-label='Month']",
                        ".//div[contains(@data-automation-id, 'issuedDate')]//input[@aria-label='Month']"
                      ],
                      "format": "MM",
                      "options": {
                        "triggerBlurEvent": false,
                        "triggerBlurInInactiveTab": true,
                        "wait": 0
                      }
                    },
                    "day": {
                      "path": [
                        ".//div[@data-automation-id='formField-certification-issue-date']//input[@aria-label='Day']",
                        ".//div[contains(@data-automation-id, 'issuedDate')]//input[@aria-label='Day']"
                      ],
                      "format": "dd",
                      "options": {
                        "triggerBlurEvent": false,
                        "triggerBlurInInactiveTab": true,
                        "wait": 0
                      }
                    },
                    "year": {
                      "path": [
                        ".//div[@data-automation-id='formField-certification-issue-date']//input[@aria-label='Year']",
                        ".//div[contains(@data-automation-id, 'issuedDate')]//input[@aria-label='Year']"
                      ],
                      "format": "yyyy",
                      "options": {
                        "wait": 0,
                        "waitForNetworkAfterInteraction": false,
                        "triggerBlurEvent": false,
                        "triggerBlurInInactiveTab": true
                      }
                    }
                  }
                ]
              }
            ]
          ]
        },
        {
          "keywords": [
            "Certification"
          ]
        }
      ],
      [
        "skill",
        {
          "containerPath": [
            ".//div[@data-automation-id='skillsSection']",
            ".//div[contains(@aria-labelledby, 'Skills-section')]"
          ],
          "entities": [
            [
              "name",
              {
                "actions": [
                  {
                    "path": [
                      ".//input[@placeholder='Search']"
                    ],
                    "method": "click",
                    "options": {
                      "waitForNetworkBeforeInteraction": true,
                      "waitForNetworkAfterInteraction": true
                    }
                  },
                  {
                    "path": [
                      ".//input[@placeholder='Search']"
                    ],
                    "method": "setValue",
                    "options": {
                      "triggerBlurEvent": false,
                      "ignoreExistingValue": true,
                      "resetValue": true
                    }
                  },
                  {
                    "path": [
                      ".//input[@placeholder='Search']"
                    ],
                    "method": "pressEnterKey",
                    "options": {
                      "waitForNetworkBeforeInteraction": true,
                      "waitForNetworkAfterInteraction": true
                    }
                  },
                  {
                    "path": [
                      "//div[@data-automation-widget='wd-popup']//div[@role='presentation']",
                      "//div[@data-associated-widget=//div[contains(@aria-labelledby, 'Skills-section')]//div[@data-automation-id='multiSelectContainer']/@id]//div[@data-automation-id='activeListContainer']"
                    ],
                    "method": "clickOptionAsync",
                    "options": {
                      "waitForNetworkBeforeInteraction": true,
                      "stopVariantsGeneration": true,
                      "checkboxSelector": [
                        "input[type='checkbox'][data-automation-id='checkboxPanel']"
                      ],
                      "optionParentSelector": [
                        "div[data-automation-id='menuItem']"
                      ]
                    }
                  }
                ]
              },
              {
                "keywords": [
                  "skills"
                ]
              }
            ]
          ],
          "options": {
            "clickOutsideAtEnd": true
          }
        },
        {
          "keywords": [
            "skills"
          ]
        }
      ],
      [
        "workAuth",
        {
          "actions": [
            {
              "path": [
                "//button[contains(@aria-label, 'authorized to work') or contains(@aria-label, 'permitted to work') or contains(@aria-label, 'eligible to work') or contains(@aria-label, 'lawfully work') or contains(@aria-label, 'legally')]",
                "//div[contains(@data-automation-id, 'formField') and .//*[contains(text(), 'authorized to work') or contains(text(), 'permitted to work') or contains(text(), 'eligible to work') or contains(text(), 'lawfully work') or contains(text(), 'legally')]]//button"
              ],
              "method": "click",
              "options": {
                "unmarkFilledStatusIfSomeFails": true
              }
            },
            {
              "path": [
                "//div[@data-automation-activepopup='true']",
                "//ul[@id=//div[contains(@data-automation-id, 'formField') and .//*[contains(text(), 'authorized to work') or contains(text(), 'permitted to work') or contains(text(), 'eligible to work') or contains(text(), 'lawfully work') or contains(text(), 'legally')]]//button/@aria-controls]"
              ],
              "method": "clickOption",
              "values": {
                "true": "Yes",
                "false": "No"
              },
              "options": {
                "waitForNetworkAfterInteraction": false
              }
            }
          ]
        },
        {
          "keywords": [
            "permitted to work",
            "authorized to work"
          ]
        }
      ],
      [
        "sponsorship",
        {
          "actions": [
            {
              "path": [
                "//button[contains(@aria-label, 'sponsorship')]"
              ],
              "method": "click",
              "options": {
                "unmarkFilledStatusIfSomeFails": true
              }
            },
            {
              "path": [
                "//div[@data-automation-activepopup='true']"
              ],
              "method": "clickOption",
              "values": {
                "true": "Yes",
                "false": "No"
              }
            }
          ]
        },
        {
          "keywords": [
            "sponsorship"
          ]
        }
      ],
      [
        "lgbt",
        {
          "actions": [
            {
              "path": [
                "//button[contains(@aria-label, 'sexual orientation')]"
              ],
              "method": "click",
              "options": {
                "unmarkFilledStatusIfSomeFails": true
              }
            },
            {
              "path": [
                "//div[@data-automation-activepopup='true']"
              ],
              "method": "clickOption",
              "values": {
                "true": "Prefer Not",
                "false": "Hetero"
              }
            }
          ]
        },
        {
          "keywords": [
            "sexual orientation"
          ]
        }
      ],
      [
        "armedForces",
        {
          "actions": [
            {
              "path": [
                "//button[contains(@aria-label, 'have you served')]",
                "//button[contains(@aria-label, 'are you serving')]"
              ],
              "method": "click",
              "options": {
                "unmarkFilledStatusIfSomeFails": true
              }
            },
            {
              "path": [
                "//div[@data-automation-activepopup='true']"
              ],
              "method": "clickOption",
              "values": {
                "true": "yes",
                "false": "no"
              }
            }
          ]
        },
        {
          "keywords": [
            "have you served",
            "are you serving"
          ]
        }
      ],
      [
        "currentDate",
        [
          "//div[@data-automation-id='formField-todaysDate']//input[@data-automation-id='dateSectionMonth-input']",
          "//div[@data-automation-id='formField-todaysDate']//input[@data-automation-id='dateSectionDay-input']",
          "//div[@data-automation-id='formField-todaysDate']//input[@data-automation-id='dateSectionYear-input']"
        ],
        {
          "keywords": [
            "date"
          ]
        }
      ],
      [
        "currentDateDashes",
        {
          "actions": [
            {
              "method": "setDateInput",
              "format": "yyyy-MM-dd",
              "month": {
                "path": [
                  "//div[contains(@data-automation-id, 'dateSignedOn')]//input[@aria-label='Month']",
                  "//div[contains(@data-automation-id, 'formField-') and contains(., 'today') and contains(., 'date')]//input[@data-automation-id='dateSectionMonth-input']"
                ],
                "format": "MM",
                "options": {
                  "wait": 250,
                  "reactDateFlow": true,
                  "ignoreExistingValue": true
                }
              },
              "day": {
                "path": [
                  "//div[contains(@data-automation-id, 'dateSignedOn')]//input[@aria-label='Day']",
                  "//div[contains(@data-automation-id, 'formField-') and contains(., 'today') and contains(., 'date')]//input[@data-automation-id='dateSectionDay-input']"
                ],
                "format": "dd",
                "options": {
                  "wait": 250,
                  "reactDateFlow": true,
                  "ignoreExistingValue": true
                }
              },
              "year": {
                "path": [
                  "//div[contains(@data-automation-id, 'dateSignedOn')]//input[@aria-label='Year']",
                  "//div[contains(@data-automation-id, 'formField-') and contains(., 'today') and contains(., 'date')]//input[@data-automation-id='dateSectionYear-input']"
                ],
                "format": "yyyy",
                "options": {
                  "wait": 250,
                  "reactDateFlow": true,
                  "ignoreExistingValue": true
                }
              },
              "options": {
                "waitForNetworkAfterInteraction": true,
                "dateOrder": [
                  "year",
                  "month",
                  "day"
                ]
              }
            }
          ]
        },
        {
          "keywords": [
            "Date"
          ]
        }
      ],
      [
        "workStartDateAvailabilityString",
        {
          "actions": [
            {
              "method": "setDateInput",
              "format": "MM/dd/yyyy",
              "month": {
                "path": [
                  "//div[*/*[(contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'start') or contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'begin') or contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'work') or contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'available')) and contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'date')]][1]//input[@data-automation-id='dateSectionMonth-input']",
                  "//div[contains(@data-automation-id, 'formField') and .//*[(contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'start') or contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'begin') or contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'work') or contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'available')) and (contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'date') or contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'start'))]][1]//input[@data-automation-id='dateSectionMonth-input']",
                  "//div[contains(@data-automation-id, 'formField') and (contains(., 'start') or contains(., 'begin') or contains(., 'available') or contains(., 'availability') or contains(., 'when') or contains(., 'join') or contains(., 'intend') or contains(., 'able'))]//input[@data-automation-id='dateSectionMonth-input']"
                ],
                "format": "MM",
                "options": {
                  "wait": 250,
                  "reactDateFlow": true,
                  "ignoreExistingValue": true
                }
              },
              "day": {
                "path": [
                  "//div[*/*[(contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'start') or contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'begin') or contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'work') or contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'available')) and contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'date')]][1]//input[@data-automation-id='dateSectionDay-input']",
                  "//div[contains(@data-automation-id, 'formField') and .//*[(contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'start') or contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'begin') or contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'work') or contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'available')) and (contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'date') or contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'start'))]][1]//input[@data-automation-id='dateSectionDay-input']",
                  "//div[contains(@data-automation-id, 'formField') and (contains(., 'start') or contains(., 'begin') or contains(., 'available') or contains(., 'availability') or contains(., 'when') or contains(., 'join') or contains(., 'intend') or contains(., 'able'))]//input[@data-automation-id='dateSectionDay-input']"
                ],
                "format": "dd",
                "options": {
                  "wait": 250,
                  "reactDateFlow": true,
                  "ignoreExistingValue": true
                }
              },
              "year": {
                "path": [
                  "//div[*/*[(contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'start') or contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'begin') or contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'work') or contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'available')) and contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'date')]][1]//input[@data-automation-id='dateSectionYear-input']",
                  "//div[contains(@data-automation-id, 'formField') and .//*[(contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'start') or contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'begin') or contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'work') or contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'available')) and (contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'date') or contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'start'))]][1]//input[@data-automation-id='dateSectionYear-input']",
                  "//div[contains(@data-automation-id, 'formField') and (contains(., 'start') or contains(., 'begin') or contains(., 'available') or contains(., 'availability') or contains(., 'when') or contains(., 'join') or contains(., 'intend') or contains(., 'able'))]//input[@data-automation-id='dateSectionYear-input']"
                ],
                "format": "yyyy",
                "options": {
                  "wait": 250,
                  "reactDateFlow": true,
                  "ignoreExistingValue": true
                }
              },
              "options": {
                "dateOrder": [
                  "year",
                  "month",
                  "day"
                ]
              }
            }
          ]
        },
        {
          "keywords": [
            "todays date",
            "start date",
            "availability",
            "available",
            "start",
            "begin",
            "able",
            "intend",
            "join",
            "when"
          ]
        }
      ],
      [
        "resume",
        [
          "//div[@data-automation-id='resumeUpload']//input[@data-automation-id='file-upload-input-ref']",
          "//div[@data-fkit-id='resumeAttachments--attachments']//input[@data-automation-id='file-upload-input-ref']",
          "//div[contains(@aria-labelledby, 'Resume')]//input[@data-automation-id='file-upload-input-ref']",
          "//div[contains(translate(@aria-labelledby, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'attachments') and //b[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'resume')]]//input[@data-automation-id='file-upload-input-ref']"
        ],
        {
          "keywords": [
            "resume",
            "application documents"
          ]
        }
      ],
      [
        "agreement",
        {
          "actions": [
            {
              "path": [
                "//input[@data-automation-id='agreementCheckbox']",
                "//input[contains(@id, 'acceptTermsAndAgreements') and @aria-checked='false']"
              ],
              "method": "click"
            }
          ]
        },
        {
          "keywords": [
            "Agree",
            "Agreement",
            "Terms and Conditions"
          ]
        }
      ],
      [
        "jobTypes",
        [
          ".//fieldset[contains(@aria-label, 'type of employment')]",
          ".//button[contains(@aria-label, 'type of employment')]"
        ],
        {
          "keywords": [
            "Type of employment"
          ]
        }
      ],
      [
        "language",
        {
          "actions": [
            {
              "path": [
                "//button[contains(@data-automation-id, 'language')]"
              ],
              "method": "click",
              "options": {
                "unmarkFilledStatusIfSomeFails": true
              }
            },
            {
              "path": [
                "//div[@data-automation-widget='wd-popup']//ul"
              ],
              "method": "clickOption",
              "values": {
                "English": [
                  "English"
                ],
                "Spanish": [
                  "Spanish"
                ],
                "": [
                  "English"
                ]
              }
            }
          ]
        },
        {
          "keywords": [
            "Language",
            "Languages"
          ]
        }
      ],
      [
        "fullName",
        {
          "actions": [
            {
              "path": [
                "//input[@id='selfIdentifiedDisabilityData--name']"
              ],
              "method": "setValue",
              "options": {
                "waitForNetworkAfterInteraction": true
              }
            }
          ]
        },
        {
          "keywords": [
            "name"
          ]
        }
      ]
    ],
    "screenshot": {
      "hide": [
        "div[data-automation-id='pageFooter']"
      ]
    },
    "alwaysSyncWindowId": true,
    "verification": {
      "enabled": true,
      "interval": 15000,
      "maxDuration": 120000
    }
  }
};
