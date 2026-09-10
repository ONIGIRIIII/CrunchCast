# Model evaluation report
Read this alongside data/README.md, which explains that difficulty_score is a proxy built from grade outcomes, not a direct measurement of student workload.

## Setup
- Train: offerings through 2013W (session_order <= 4027), 99,483 rows.
- Test: offerings from 2014S through 2016W (strictly out-of-time), 19,024 rows.
- Boosting rounds (400) chosen by early stopping on an inner validation slice (2012S-2013W), never on the test set itself.
- The model actually shipped in the API is refit on ALL available data (1996-2016) using the same config; see model/train.py's module docstring for why, and note that this means the numbers below are a lower bound on the shipped model's real quality, not a direct score of it.

## Headline metrics (difficulty_score, 0-100 scale)
| Model | MAE | RMSE | R2 |
|---|---|---|---|
| Heuristic baseline (historical lookup, no ML) | 16.38 | 21.35 | 0.448 |
| XGBoost | 16.00 | 20.47 | 0.492 |

XGBoost reduces MAE by 2.3% versus the heuristic baseline, i.e. it's better than just looking up a course's own trailing history, but not by a huge margin. That's expected: most of the signal in this proxy label IS a course/subject's own history, so a big jump over that baseline would be more suspicious than reassuring.

## Feature importance (gain, top 10)
                       feature          gain  gain_pct
   hist_course_mean_difficulty 241343.562500 60.413254
  hist_subject_mean_difficulty  63198.757812 15.819948
hist_professor_mean_difficulty  30664.833984  7.676038
                       subject  18523.664062  4.636854
                       session   8922.502930  2.233486
                  course_level   7671.852051  1.920422
   hist_course_offerings_count   7651.209473  1.915255
     hist_course_mean_enrolled   6311.145020  1.579809
  hist_subject_offerings_count   4077.781250  1.020752
hist_professor_offerings_count   3968.773438  0.993466

## Error by subject (min 20 test rows)
### Hardest to predict
         mean_abs_error  count
subject                       
SCIE          27.745470     83
FIST          25.765938     46
GPP           24.888168     22
VANT          23.963437     88
FNIS          23.935934     23
GRSJ          23.791862    109
BMEG          23.551270     30
RUSS          23.348446     43
LLED          23.287018    279
DSCI          23.148935     25

### Easiest to predict
         mean_abs_error  count
subject                       
MIDW           4.101288     42
BAAC           8.870290     40
BAHR           9.570170     61
PSYC           9.783375    454
BASC          10.270573     40
BUSI          10.431776    406
DHYG          10.542338     62
ENDS          10.569730     34
EDCP          10.613959    167
NURS          10.649342    223

## Error by course level
                   mean  count
course_level                  
0             33.274005      9
100           17.491337   3294
200           16.843438   3065
300           14.596083   5064
400           15.687991   3919
500           16.258248   3609
600           11.591019     64

## Worst 15 individual predictions
 year session subject course section  difficulty_score  pred_xgboost  pred_baseline  abs_error_xgb  hist_course_offerings_count
 2014       W    CRWR    501     D01         99.614986      9.286074       3.101831      90.328912                            5
 2016       W    CRWR    416     002         93.303335      6.597652       6.927324      86.705683                            4
 2015       W    CRWR    509     D01         98.558665     12.448444      12.346118      86.110221                           25
 2014       W    EPSE    271     D03         99.962056     16.627607      18.836843      83.334448                            0
 2014       S    ECED    531     97A         98.632706     15.410501       7.715090      83.222206                            1
 2014       W    EPSE    411     074         95.175074     12.212967      15.853768      82.962107                           16
 2016       W    DHYG    310     001         92.292905     10.420928      13.408149      81.871977                            7
 2014       W    LLED    200     V01         99.674761     18.304697      19.309985      81.370064                           49
 2016       W    EDCP    562     61A         97.018609     15.950301      19.065900      81.068308                           33
 2015       W    MATH    255     104          1.360581     82.289345      83.455637      80.928764                           96
 2014       W    LLED    200     V02         99.940373     19.691694      20.917281      80.248679                           50
 2016       W    MIDW    305     001         83.426541      3.741729       6.713125      79.684812                            4
 2014       W    PSYC    440     002         96.305679     16.909985      12.067515      79.395695                           24
 2014       W    LLED    200     V06         98.639419     19.971125      22.466753      78.668294                           51
 2014       W    CRWR    406     001         81.861151      4.183602       8.331023      77.677549                            9

## Error analysis notes
- Courses/subjects with few historical offerings (low `hist_course_offerings_count`) tend to have the largest errors, since the model falls back to a coarser subject-level or global estimate. This is visible in the worst-predictions table above.
- difficulty_score is percentile-ranked WITHIN course_level (100/200/.../600), not across the whole catalog: a score of 80 means 'harder than about 80% of OTHER COURSES AT THIS LEVEL,' not an absolute workload amount, and not a comparison to, say, a 600-level seminar. This was a deliberate fix - an earlier global-percentile version made nearly every 100-level course look 'hard' purely because the catalog is full of generously-graded grad courses, which was a useless comparison for a student picking between intro courses. See data/README.md and 'Error by course level' above (now roughly even across levels, as intended - the MAE is higher than a global ranking would report, which is the honest cost of removing an easy-to-predict but not-useful signal).
- Small-enrollment sections were already excluded upstream (enrolled < 10, see data/README.md), so remaining errors are not primarily a small-sample-size artifact at the row level, though they can still be at the course level for rarely-offered courses.
- The worst individual predictions above still skew toward small, specialized cohorts (grad/professional-program-flavored subjects recur). The likely reason: small, homogeneous cohorts can swing the percentile-ranked score from near 0 to near 100 with almost no change in the raw average grade, and the model - trained on that course's typically-calm history - has no way to see it coming. This is a real limitation of the proxy label's sensitivity for small cohorts, not a generic ML failure.

## Limitations (see also top-level README)
- **Proxy label, not workload.** difficulty_score reflects grade outcomes (avg, fail rate, grade spread), which correlate with but are not the same thing as how much work a course actually takes. A generously-graded but time-consuming course would score as 'easy' here.
- **Grade data reliability window.** Only 2016W and earlier PAIR data is used; anything about 2017+ trends (curriculum changes, grading policy shifts, new instructors) is invisible to this model, and predictions for the current catalog are extrapolations from up to a decade of historical drift.
- **Professor feature is sparse.** About half of rows have no usable professor-level history (name inconsistency across years); the model can't use instructor identity as a reliable signal for most courses.
- **No real section-timing/workload signal at all** (e.g. reading load, assignment frequency, project-based vs. exam-based grading) exists in this data source; the model is limited to what grade distributions can tell us.
