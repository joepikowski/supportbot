# SupportBot Commands

SupportBot is an IRC bot with multiple API integrations to increase efficiency and improve visibility into case load and platform stability.

The following commands are entered into the IRC channel or a SupportBot PM. Input values are parsed independently, so the syntax can be loose ( `!onduty joe next 4` is the same as `!onduty next joe 4` , etc).

## Calendar / On Duty

### !onduty

*   *`[no params]`* => Defaults to "today"

*   **Date Parameters**

    * `today`, `tonight`
    
    * `yesterday`
    
    * `tomorrow`
    
    * `mon` , `tues`, `wed` , etc.
        * If the day of the week has passed, jumps to next week
        * E.g. If today is *Wed 12/25*:
        
                 !onduty wed => Returns today (12/25)
                 !onduty tues => Returns next Tuesday (12/31)
                 !onduty next wed => Returns next week (1/1)
                 
    * `monday`, `tuesday`, `wednesday` , etc.
    * `12/15`, `1/10`, `03/01/14`, `5/5/2014`
        * If the date has no year, and is not in the current month, jump to next year
            E.g. If today is *Wed 12/25/13*:
            
                !onduty 12/01 => Returns 12/01/2013
                !onduty 1/5 => Returns 1/5/2014
                !onduty 11/30 => Returns 11/30/2014
                

*   **Range Parameters**

    * `[0-99]` => Minimum values to return, if available
        * Default is `1`
        
                !onduty 12/5 5 => Returns 5 days starting with 12/5
                !onduty joe 3 => Returns next 3 on-call dates for Joe
                
    * `next` => Used in conjunction with a weekday (e.g. `mon` ) or agent (e.g. `Joe` )
        * Not necessary with agent query, but allowed since the syntax seems natural
        
                !onduty next tue => Advances the checked date by 1 week
                !onduty satia next 4 => Returns next 4 on-call dates for Satia
                
*   **Agent Parameters**

    * `agent name` => 
    
        * E.g `Joe`, `Johnson`, `Satia`
        
        * Case insensitive
        
        * IRC names can also be used as long as the IRC nick contains the agent name
        
        * Can be combined with range parameter

### !ooo

*   Unlike `!onduty`, `!ooo` will always return all events when only given a date range.

*   It otherwise uses the same input structure as `!onduty` . (See above)


### !vbx

*   `[no params]` => Currently unsupported, eventually will show current status!

*   **Instruction Parameters**

    * `on`
        * Adds all specified agents (or if none, the speaker) to VBX
    * `off`
        * Removes all specified agents (or if none, the speaker) from VBX
    * `only`
        * Adds all specified agents (or if none, the speaker) and removes all others


*   **Agent Parameters**

    * `agent name` => 
    
        * E.g `Joe`, `Johnson`, `Satia`
        
        * Multiple agents supported, e.g.
        
                !vbx on joe kana office
                
        * Case insensitive
        
        * IRC names can also be used as long as the IRC nick contains the agent name


## Zendesk

### !zd

*   `[no params]` => Returns all unassigned cases (INBOX view in Zendesk)

*   **Case ID**

    * `####` => Returns details for Case ID
        * Up to 3 digits only... sorry case #99!
        
                !zd 4200 => Details and URL for ZD #4200


*   **Pass and Take**

    * `pass` `[case id]` `[agent name]` =>
        * Assigns specified ZD case to the target as `Open`
        * Agent names as specified above
        * IRC names can also be used as long as the IRC nick contains the agent name, e.g.
        
                !zd pass 1234 kana
                
    * `take` `[case id]` =>
        * Assigns specified ZD to the speaker as `Open` , e.g.
            
                !zd take 1234
                    

*   **Agent and Organization**

    * `agent name` =>
    
        * E.g `Joe`, `Johnson`, `Satia`
        
        * Case insensitive
        
        * Can be combined with case status parameter, range parameter (default is `Open` , `3`)

    * *organization name =>
        * Autocompletes based on ZD Client Name
        * E.g. `thril` for Thrillist, `doggy` for DoggyLoot
        * Can be combine*d with case status parameter, range parameter (default is `Open` , `3`)
            
 
*   **Case Status Parameter**

    * `case status` =>
    
        * `New`, `Open`, `Pending`, `Solved` or `Closed`
        
        * Defaults to last 3 cases with that status

*   **Range Parameter**

    * `[0-99]` => Minimum values to return, if available
    
        * Default is `3`
        
                !zd joe pending 3 => Returns most recent 3 pending cases for Joe
                !zd thril solved 5 => Returns last 5 solved cases for Thrillist



## Stability

### !mon

*   Displays any open stability alert issues and the time since the issue began (see 'Stability Monitoring' under Cron Jobs / Monitoring below)


## Wolfram Alpha

### !wa

*   Makes use of the Wolfram Alpha API to add a variety of utilities and search functionality to SupportBot
*   Returns only plain text results; limit of 2000 per month, so don't abuse the feature!

*   **Search Parameter**

    * `[Wolfram Alpha Search String]` => 
        * Returns the interpretation of the input and the first result
        * Useful / fun examples that work well with plaintext:
                Basic Arithmetic: 125 + 375, 1/4 * (4 - 1/2)
                Word Definitions: define proxy
                Unit conversion: 15800ms in minutes, 1101010100010 binary to decimal

                IP Lookup: 194.37.109.10
                Web Address Lookup: sailthru.com
                Typical Port Use: port 80
                File Format Lookup: .csv file format
                Password Strength Analysis: analyze password opensesame

                Timestamp Parsing: unix 1379089235
                Character Encoding: copyright sign, unicode 169, ascii 40
                Hashing: md5 "apikeyandapisecret"

                Weather: weather, weather forecast, weather new york 1/5/1990
                Lottery Odds: lottery
                Morse Code: morse code sailthru rules
                Smiley Face Interpretation: :-|

### !wav

*   Identical to `!wa`, but is verbose (will return all valid plaintext responses)

### !ts

*   Takes a UNIX timestamp as a parameter, equivalent of `!wa unix [timestamp] EST`


## Fun

### !wtf

*   Returns a random, "WTF"-worthy line from the more interesting Support cases we've gotten over time
*   Add to the WTF doc here
    *   Keep each row to one line, no line breaks
    *   Use single quotes ' instead of double quotes "
    *   ~400 character limit per row



## Cron Jobs / Monitoring

### Zendesk Cases

*   **Unclaimed Cases**

    * SupportBot will alert the `#support` channel if a case has been unassigned for 15 minutes


### Stability Monitoring

*   **Checks Every 60 Seconds:**
        MY - Basic 200 OK
        SU - Basic 200 OK
        WWW - Basic 200 OK
        Feed - Valid JSON and Basic 200 OK
        Link - 200 OK and Proper Redirect (4 Links in Total)
        API - Checks 200 Response from 
            GET: User, Content, Stats, List and Template
            POST: Email, Content, Purchase, Blast and Job

*   Any individual failure will retry 3 times (in 10s intervals), and then alert the `#support` channel in IRC (see `!mon` )
*   An Alert Resolved message will be sent on the next successful attempt


### On Duty

*   **Sailbot's `!ondutycs`**

    * SupportBot will automatically update Sailbot with the current CSE On Duty
    
        * **Weekdays**:
            * Update at :
                * `7pm EDT` (Robert)
                * `8pm EDT` (Evening On-Duty)
                * `9pm EDT` (Robert)
                * `11pm EDT` (Evening On-Duty)
                * `4am EDT` (Kirsty)
            
        * **Weekends**:
        
            * Update at `1am EDT` Saturday and Sunday (for good measure)



## Starting Up and Rebooting SupportBot

*   SupportBot uses `tmux` to run in a separate session from your own. That way, when you log off, SupportBot stays running.

    1. Log into the Support Box ( `162.243.109.239` )

    2. Whether SupportBot is in the session or not, you need to first shut him down by typing `supportbotstop`

    3. Then, type `supportbotsession` to start the session SupportBot will run in

    4. Type `supportbotgo` to start him up. SupportBot should log in.

    5. Type `Ctrl+b` (for pc and mac), and then `d` (don't hold `ctrl` down) to detach from the session.





## Checking Logs

*   SupportBot's root directory is currently located at `~/joe/supportbot`

    1. Log into the Support Box ( `162.243.109.239` )

    2. To tail the SupportBot logs and get additional details on error messages, type `tail -f ~/joe/supportbot/log/log`.



## Planned Tweaks / Features

* OpenVBX Monitor Showing Current Agents On Phones

* Function Aliasing / Macro Functions (h/t Irina)

* Adjust `!onduty` to switch over at 8am, not midnight

* ~~`!ooo` => Will display agents out of office for the day~~ (h/t Satia) **DONE**

* ~~Add support for private messages to SupportBot~~ **DONE**

* ~~Adjust `!zd` to detect Phone Cases / Suspended Cases~~ **DONE**

* ~~Ability to check test send, prod. send, api calls from IRC~~ **DONE**

* ~~Compensate for the ZD ~1min Inbox delay (cases just claimed still show up)~~ **DONE**

* ~~Wolfram Alpha API Integration (h/t Johnson)~~ **DONE**
